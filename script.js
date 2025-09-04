 // ===== App State / Elements =====
    let isLoggedIn=false,currentUser=null,pendingLoginUser=null,twoFACode=null,userEmail=null;
    const loginBtn=document.getElementById('loginBtn'),registerBtn=document.getElementById('registerBtn'),heroPlayBtn=document.getElementById('hero-play-btn');
    const loginModal=document.getElementById('loginModal'),registerModal=document.getElementById('registerModal'),twofaModal=document.getElementById('twofaModal');
    const authButtons=document.getElementById('auth-buttons'),userDashboard=document.getElementById('user-dashboard'),userMenuBtn=document.getElementById('user-menu-btn'),userMenu=document.getElementById('user-menu');
    const logoutBtn=document.getElementById('logoutBtn'),profileBtn=document.getElementById('profileBtn');
    const notification=document.getElementById('notification'),twofaCodeHint=document.getElementById('twofaCodeHint'),userBalanceAmount=document.getElementById('user-balance-amount');

    // Validation flags
    let isEmailValid=false,isPasswordValid=false,isUsernameValid=false,doPasswordsMatch=false;

    // ===== Storage: Users =====
    function initializeUsers(){ if(!localStorage.getItem('casinoUsers')) localStorage.setItem('casinoUsers', JSON.stringify([])); }
    function getUsers(){ return JSON.parse(localStorage.getItem('casinoUsers')||'[]'); }
    function saveUser(user){ const users=getUsers(); users.push(user); localStorage.setItem('casinoUsers', JSON.stringify(users)); }
    function findUser(identifier){ return getUsers().find(u=>u.email===identifier||u.username===identifier); }
    function usernameExists(username){ return getUsers().some(u=>u.username===username); }
    function emailExists(email){ return getUsers().some(u=>u.email===email); }

    // persist balance/session for currentUser
    function persistCurrentUser(){
      if(!currentUser) return;
      const users=getUsers(); const idx=users.findIndex(u=>u.email===currentUser.email);
      if(idx>-1){ users[idx]={...users[idx], balance: currentUser.balance}; localStorage.setItem('casinoUsers', JSON.stringify(users)); }
      const saved=JSON.parse(localStorage.getItem('currentUser')||'{}'); const sessionExpiry=saved.sessionExpiry || (Date.now()+7*24*60*60*1000);
      localStorage.setItem('currentUser', JSON.stringify({...currentUser, sessionExpiry}));
      userBalanceAmount.textContent=`€${(currentUser.balance||0).toFixed(2)}`;
    }

    // ===== UI helpers =====
    function showSection(id){ 
      document.querySelectorAll('.page-section').forEach(s=>s.style.display='none'); 
      document.getElementById(id+'-section').style.display='block'; 
      window.scrollTo(0,0);
      
      // Navigation aktualisieren
      updateNavIndicator(id);
    }
    
    function updateNavIndicator(currentSection) {
      const navItems = document.querySelectorAll('nav ul li a');
      navItems.forEach(item => {
        item.classList.remove('active');
      });
      
      // Je nach aktueller Sektion den entsprechenden Nav-Punkt markieren
      if (currentSection === 'games' || currentSection === 'slots' || currentSection === 'blackjack' || currentSection === 'roulette' || currentSection === 'plinko') {
        document.getElementById('nav-games').classList.add('active');
      } else if (currentSection === 'home') {
        document.getElementById('nav-home').classList.add('active');
      }
    }

    function showNotification(message,isError=false){ const n=notification; n.textContent=message; n.classList.remove('error'); if(isError) n.classList.add('error'); n.classList.add('show'); setTimeout(()=>n.classList.remove('show'),3000); }
    function validateEmail(email){ const re=/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/; return re.test(String(email).toLowerCase()); }
    function validatePassword(p){ return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d\s]).{8,}$/.test(p); }
    function calculatePasswordStrength(p){ let s=0; if(p.length>=8)s+=20;if(/[a-z]/.test(p))s+=20;if(/[A-Z]/.test(p))s+=20;if(/[0-9]/.test(p))s+=20;if(/[^a-zA-Z\d\s]/.test(p))s+=20;return s; }
    function updatePasswordStrength(p){ const w=calculatePasswordStrength(p); const bar=document.getElementById('passwordStrengthBar'); bar.style.width=`${w}%`; bar.style.background=w<40?'#e74c3c':(w<80?'#f39c12':'#2ecc71'); }
    function resetFormValidation(){ isEmailValid=false;isPasswordValid=false;isUsernameValid=false;doPasswordsMatch=false; document.getElementById('registerSubmit').disabled=true; document.querySelectorAll('.error-message').forEach(el=>el.style.display='none'); document.getElementById('passwordStrengthBar').style.width='0%'; }

    function updateUIForLogin(user){
      isLoggedIn=true; currentUser=user; authButtons.style.display='none'; userDashboard.style.display='flex';
      document.getElementById('hero-play-btn').textContent='Jetzt spielen'; userBalanceAmount.textContent=`€${(user.balance||0).toFixed(2)}`;
      const sessionExpiry=Date.now()+7*24*60*60*1000; localStorage.setItem('currentUser', JSON.stringify({...user, sessionExpiry}));
    }
    function updateUIForLogout(showMsg=true){
      if(showMsg) showNotification('Du wurdest abgemeldet.');
      isLoggedIn=false; currentUser=null; pendingLoginUser=null; authButtons.style.display='flex'; userDashboard.style.display='none';
      document.getElementById('hero-play-btn').textContent='Jetzt spielen'; userMenu.classList.remove('show'); localStorage.removeItem('currentUser');
      resetBlackjackUI(true);
    }
    function checkSessionOnLoad(){
      const saved=localStorage.getItem('currentUser'); if(!saved) return;
      const obj=JSON.parse(saved);
      if(!obj.sessionExpiry||Date.now()>obj.sessionExpiry){ updateUIForLogout(false); showNotification('Sitzung abgelaufen. Bitte melde dich erneut an.', true); }
      else{ updateUIForLogin(obj); }
    }

    // ===== 2FA =====
    function generate2FACode(){ return Math.floor(100000+Math.random()*900000).toString(); }
    function send2FACode(email){ twoFACode=generate2FACode(); userEmail=email; twofaCodeHint.textContent=`Testcode: ${twoFACode} (In echter App per E-Mail)`; showNotification(`Bestätigungscode wurde an ${email} gesendet`); }
    function resend2FACode(){ if(userEmail){ send2FACode(userEmail); showNotification('Neuer Code wurde gesendet'); } }

    // ===== App init / events =====
    document.addEventListener('DOMContentLoaded',()=>{
      initializeUsers(); checkSessionOnLoad();

      // login inputs
      document.getElementById('loginEmail').addEventListener('blur',function(){ document.getElementById('loginEmailError').style.display=this.value.length===0?'block':'none'; });
      document.getElementById('loginPassword').addEventListener('blur',function(){ document.getElementById('loginPasswordError').style.display=this.value.length===0?'block':'none'; });

      // register inputs
      document.getElementById('registerUsername').addEventListener('input',function(){
        const err=document.getElementById('usernameError'); isUsernameValid=this.value.length>=3;
        if(usernameExists(this.value)){ err.textContent='Dieser Benutzername ist bereits vergeben'; err.style.display='block'; isUsernameValid=false; }
        else{ err.textContent='Benutzername muss mindestens 3 Zeichen lang sein'; err.style.display=(!isUsernameValid&&this.value.length>0)?'block':'none'; }
        validateRegisterForm();
      });
      document.getElementById('registerEmail').addEventListener('input',function(){
        const err=document.getElementById('emailError'); isEmailValid=validateEmail(this.value);
        if(emailExists(this.value)){ err.textContent='Diese E-Mail-Adresse ist bereits registriert'; err.style.display='block'; isEmailValid=false; }
        else{ err.textContent='Bitte gib eine gültige E-Mail-Adresse ein'; err.style.display=(!isEmailValid&&this.value.length>0)?'block':'none'; }
        validateRegisterForm();
      });
      document.getElementById('registerPassword').addEventListener('input',function(){
        const err=document.getElementById('passwordError'); isPasswordValid=validatePassword(this.value); updatePasswordStrength(this.value);
        err.style.display=(!isPasswordValid&&this.value.length>0)?'block':'none';
        const c=document.getElementById('registerConfirmPassword').value; if(c.length>0){ doPasswordsMatch=this.value===c; document.getElementById('confirmPasswordError').style.display=doPasswordsMatch?'none':'block'; }
        validateRegisterForm();
      });
      document.getElementById('registerConfirmPassword').addEventListener('input',function(){
        const p=document.getElementById('registerPassword').value; const err=document.getElementById('confirmPasswordError'); doPasswordsMatch=this.value===p; err.style.display=(!doPasswordsMatch&&this.value.length>0)?'block':'none'; validateRegisterForm();
      });

      document.getElementById('twofaCode').addEventListener('input',function(){ const e=document.getElementById('twofaError'); const ok=/^\d{6}$/.test(this.value); e.style.display=(!ok&&this.value.length>0)?'block':'none'; });

      // contact
      const contactForm=document.getElementById('contactForm'),contactSubmitBtn=document.getElementById('contactSubmitBtn');
      if(contactForm){ contactForm.addEventListener('submit',async function(e){
        e.preventDefault(); const name=document.getElementById('contactName').value.trim(),email=document.getElementById('contactEmail').value.trim(),subject=document.getElementById('contactSubject').value.trim(),message=document.getElementById('contactMessage').value.trim();
        if(!name||!email||!subject||!message){ showNotification('Bitte füllen Sie alle Felder aus',true); return; } if(!validateEmail(email)){ showNotification('Bitte geben Sie eine gültige E-Mail-Adresse ein',true); return; }
        showNotification('Nachricht wird gesendet...'); contactSubmitBtn.disabled=true;
        try{ const fd=new FormData(contactForm); fd.set('_subject',subject?`Kontakt: ${subject}`:'Neue Nachricht über JeeBet'); const resp=await fetch(contactForm.action,{method:'POST',body:fd,headers:{'Accept':'application/json'}}); if(resp.ok){ showNotification('Ihre Nachricht wurde erfolgreich gesendet!'); contactForm.reset(); } else { const data=await resp.json().catch(()=>({})); const msg=data?.errors?.map(e=>e.message).join(', ')||resp.statusText; showNotification('Senden fehlgeschlagen: '+msg,true); } }
        catch{ showNotification('Netzwerkfehler beim Senden',true); }
        finally{ contactSubmitBtn.disabled=false; }
      });}
    });

    function validateRegisterForm(){ const btn=document.getElementById('registerSubmit'); btn.disabled=!(isEmailValid&&isPasswordValid&&isUsernameValid&&doPasswordsMatch); }

    // open/close modals
    function switchToRegister(){ loginModal.style.display='none'; registerModal.style.display='flex'; resetFormValidation(); }
    function switchToLogin(){ registerModal.style.display='none'; twofaModal.style.display='none'; loginModal.style.display='flex'; resetFormValidation(); }
    loginBtn.addEventListener('click',()=>{ loginModal.style.display='flex'; resetFormValidation(); });
    registerBtn.addEventListener('click',()=>{ registerModal.style.display='flex'; resetFormValidation(); });
    heroPlayBtn.addEventListener('click',()=>{ if(isLoggedIn){ playGame('Willkommensspiel'); } else { registerModal.style.display='flex'; }});
    document.querySelectorAll('.close-modal').forEach(btn=>btn.addEventListener('click',()=>{ loginModal.style.display='none'; registerModal.style.display='none'; twofaModal.style.display='none'; document.getElementById('bjContinueModal').style.display='none'; resetFormValidation(); }));
    window.addEventListener('click',(e)=>{ if(e.target===loginModal){ loginModal.style.display='none'; resetFormValidation(); } if(e.target===registerModal){ registerModal.style.display='none'; resetFormValidation(); } if(e.target===twofaModal){ twofaModal.style.display='none'; } if(e.target===document.getElementById('bjContinueModal')){ document.getElementById('bjContinueModal').style.display='none'; } if(!userDashboard.contains(e.target)) userMenu.classList.remove('show'); });

    // user menu
    userMenuBtn.addEventListener('click',()=>{ if(!isLoggedIn){ showNotification('Bitte zuerst anmelden.',true); return; } userMenu.classList.toggle('show'); });
    logoutBtn.addEventListener('click',()=>{ updateUIForLogout(true); });
    profileBtn.addEventListener('click',()=>{ userMenu.classList.remove('show'); showNotification('Mein Konto geöffnet (Demo).'); });

    // generic play/claim
    function playGame(name){ if(isLoggedIn){ showNotification(`${name} wird gestartet...`); } else { showNotification('Bitte melde dich zuerst an, um zu spielen', true); loginModal.style.display='flex'; } }
    function claimBonus(name){ if(isLoggedIn){ showNotification(`${name} wurde deinem Konto gutgeschrieben`); } else { showNotification('Bitte melde dich zuerst an, um Boni zu beanspruchen', true); loginModal.style.display='flex'; } }

    // auth flows
    document.getElementById('loginForm').addEventListener('submit',(e)=>{
      e.preventDefault();
      const id=document.getElementById('loginEmail').value.trim(), pw=document.getElementById('loginPassword').value;
      if(!id){ showNotification('Bitte gib deinen Benutzernamen oder E-Mail ein',true); return; }
      if(!pw){ showNotification('Bitte gib dein Passwort ein',true); return; }
      const user=findUser(id); if(!user){ showNotification('Benutzer nicht gefunden',true); return; }
      if(user.password!==pw){ showNotification('Ungültiges Passwort',true); return; }
      pendingLoginUser=user; loginModal.style.display='none'; send2FACode(user.email); twofaModal.style.display='flex';
    });
    document.getElementById('registerForm').addEventListener('submit',(e)=>{
      e.preventDefault();
      if(!isEmailValid||!isPasswordValid||!isUsernameValid||!doPasswordsMatch){ showNotification('Bitte überprüfe deine Eingaben',true); return; }
      const username=document.getElementById('registerUsername').value.trim(), email=document.getElementById('registerEmail').value.trim(), password=document.getElementById('registerPassword').value;
      const newUser={username,email,password,balance:100.00,createdAt:new Date().toISOString()};
      saveUser(newUser); showNotification('Registrierung erfolgreich! Du kannst dich jetzt anmelden.'); registerModal.style.display='none'; document.getElementById('registerForm').reset(); resetFormValidation();
    });
    document.getElementById('twofaForm').addEventListener('submit',(e)=>{
      e.preventDefault();
      const code=document.getElementById('twofaCode').value;
      if(!/^\d{6}$/.test(code)){ showNotification('Bitte gib einen gültigen 6-stelligen Code ein',true); return; }
      if(code!==twoFACode){ showNotification('Ungültiger Bestätigungscode',true); return; }
      if(pendingLoginUser){ twofaModal.style.display='none'; updateUIForLogin(pendingLoginUser); showNotification('Anmeldung erfolgreich!'); pendingLoginUser=null; }
    });
    setInterval(()=>{ const saved=localStorage.getItem('currentUser'); if(!saved) return; const obj=JSON.parse(saved); if(!obj.sessionExpiry||Date.now()>obj.sessionExpiry){ updateUIForLogout(false); showNotification('Sitzung abgelaufen. Bitte melde dich erneut an.', true); } }, 15*60*1000);

    // ===== Blackjack =====
    let shoe=[], playerHand=[], dealerHand=[], roundActive=false, hiddenDealerCard=null, currentBet=0;
    const bjBet=document.getElementById('bjBet'), bjStart=document.getElementById('bjStart'), bjHit=document.getElementById('bjHit'), bjStand=document.getElementById('bjStand'), bjDouble=document.getElementById('bjDouble');
    const dealerCardsEl=document.getElementById('dealerCards'), playerCardsEl=document.getElementById('playerCards'), dealerScoreEl=document.getElementById('dealerScore'), playerScoreEl=document.getElementById('playerScore'), bjResultEl=document.getElementById('bjResult'), bjBalanceInfo=document.getElementById('bjBalanceInfo'), bjShoeInfo=document.getElementById('bjShoeInfo');
    const bjContinueModal=document.getElementById('bjContinueModal'), bjYes=document.getElementById('bjYes'), bjNo=document.getElementById('bjNo'), bjRoundSummary=document.getElementById('bjRoundSummary');

    function openBlackjack(){
      if (!isLoggedIn) {
        showNotification('Bitte melde dich an, um Black Jack zu spielen.', true);
        loginModal.style.display = 'flex';
        return;
      }
      showSection('blackjack');
      updateBjBalanceInfo();
      if (shoe.length === 0) buildAndShuffleShoe();
      bjShoeInfo.textContent = `Karten im Shoe: ${shoe.length}`;
    }

    function buildAndShuffleShoe(){
      const ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'], suits=['♠','♥','♦','♣'];
      shoe=[];
      for(let d=0; d<6; d++){ for(const r of ranks){ for(const s of suits){ shoe.push({r,s}); } } }
      for(let i=shoe.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [shoe[i],shoe[j]]=[shoe[j],shoe[i]]; }
      showNotification('Neuer Shoe gemischt.');
    }
    function cardValue(card){ if(card.r==='A') return 11; if(['K','Q','J','10'].includes(card.r)) return 10; return parseInt(card.r,10); }
    function handValue(hand){ let total=0, aces=0; for(const c of hand){ total+=cardValue(c); if(c.r==='A') aces++; } while(total>21 && aces>0){ total-=10; aces--; } return total; }
    function renderCard(card, hidden=false){ const div=document.createElement('div'); div.className='card'+((card.s==='♥'||card.s==='♦')?' red':''); if(hidden) div.classList.add('hidden-card'); div.textContent=hidden?'??':(`${card.r}${card.s}`); return div; }
    function renderHands(showDealerHole=false){
      dealerCardsEl.innerHTML=''; playerCardsEl.innerHTML='';
      dealerHand.forEach((c,i)=>dealerCardsEl.appendChild(renderCard(c, i===1 && !showDealerHole && hiddenDealerCard)));
      playerHand.forEach(c=>playerCardsEl.appendChild(renderCard(c,false)));
      playerScoreEl.textContent=`(${handValue(playerHand)})`;
      dealerScoreEl.textContent= showDealerHole ? `(${handValue(dealerHand)})` : '(?)';
    }
    function dealCard(target){ if(shoe.length===0) buildAndShuffleShoe(); return target.push(shoe.pop()); }
    function resetBlackjackUI(clear=false){
      playerHand=[]; dealerHand=[]; hiddenDealerCard=false; bjResultEl.textContent=''; dealerCardsEl.innerHTML=''; playerCardsEl.innerHTML='';
      bjHit.disabled=true; bjStand.disabled=true; bjDouble.disabled=true; roundActive=false;
      if(clear) currentBet=0;
      bjShoeInfo.textContent=`Karten im Shoe: ${shoe.length}`;
    }
    function updateBjBalanceInfo(){ bjBalanceInfo.textContent = currentUser ? `Kontostand: €${(currentUser.balance||0).toFixed(2)}` : ''; }

    function startRound(){
      if(!isLoggedIn){ showNotification('Bitte zuerst anmelden',true); return; }
      const bet = parseInt(bjBet.value,10) || 0;
      if(bet<=0){ showNotification('Bitte einen Einsatz > 0 setzen',true); return; }
      if(currentUser.balance < bet){ showNotification('Nicht genügend Guthaben',true); return; }

      if(shoe.length<52){ buildAndShuffleShoe(); }

      resetBlackjackUI();
      currentBet = bet;
      currentUser.balance -= bet; persistCurrentUser(); updateBjBalanceInfo();

      dealCard(playerHand); dealCard(dealerHand);
      dealCard(playerHand); dealCard(dealerHand); hiddenDealerCard=true;
      renderHands(false);

      const p=handValue(playerHand), d=handValue(dealerHand);
      if(p===21 && d!==21){ finishRound('blackjack'); return; }
      roundActive=true; bjHit.disabled=false; bjStand.disabled=false; bjDouble.disabled=(currentUser.balance<bet);
      bjShoeInfo.textContent=`Karten im Shoe: ${shoe.length}`;
    }

    function playerHit(){
      if(!roundActive) return;
      bjDouble.disabled = true;
      dealCard(playerHand);
      renderHands(false);
      const v = handValue(playerHand);
      if(v>21){ finishRound('player_bust'); }
    }
    function playerStand(){
      if(!roundActive) return;
      roundActive=false; bjHit.disabled=true; bjStand.disabled=true; bjDouble.disabled=true;
      hiddenDealerCard=false; renderHands(true);
      while(handValue(dealerHand) < 17){ dealCard(dealerHand); renderHands(true); }
      const pv=handValue(playerHand), dv=handValue(dealerHand);
      if(dv>21) finishRound('dealer_bust');
      else if(pv>dv) finishRound('player_win');
      else if(pv<dv) finishRound('dealer_win');
      else finishRound('push');
    }
    function playerDouble(){
      if(!roundActive) return;
      if(currentUser.balance < currentBet){ showNotification('Zu wenig Guthaben zum Verdoppeln', true); return; }
      currentUser.balance -= currentBet; persistCurrentUser(); updateBjBalanceInfo();
      currentBet *= 2;
      dealCard(playerHand); renderHands(false);
      if(handValue(playerHand)>21){ finishRound('player_bust'); } else { playerStand(); }
    }

    function finishRound(outcome){
      roundActive=false; bjHit.disabled=true; bjStand.disabled=true; bjDouble.disabled=true; hiddenDealerCard=false; renderHands(true);
      let text=''; let delta=0;
      switch(outcome){
        case 'blackjack': delta=Math.floor(currentBet*1.5)+currentBet; text=`Blackjack! Du gewinnst €${(currentBet*1.5).toFixed(2)} (+Einsatz).`; break;
        case 'player_bust': delta=0; text='Überkauft! Du verlierst deinen Einsatz.'; break;
        case 'dealer_bust': delta=currentBet*2; text='Dealer überkauft! Du gewinnst.'; break;
        case 'player_win':  delta=currentBet*2; text='Du gewinnst!'; break;
        case 'dealer_win':  delta=0; text='Dealer gewinnt.'; break;
        case 'push':        delta=currentBet; text='Unentschieden (Push) – Einsatz zurück.'; break;
      }
      if(delta>0){ currentUser.balance += delta; persistCurrentUser(); updateBjBalanceInfo(); }
      bjResultEl.textContent=text;
      bjShoeInfo.textContent=`Karten im Shoe: ${shoe.length}`;
      bjRoundSummary.textContent = `Ergebnis: ${text}   |   Kontostand: €${currentUser.balance.toFixed(2)}`;
      document.getElementById('bjContinueModal').style.display='flex';
    }

    // Buttons
    document.getElementById('bjStart').addEventListener('click', startRound);
    document.getElementById('bjHit').addEventListener('click', playerHit);
    document.getElementById('bjStand').addEventListener('click', playerStand);
    document.getElementById('bjDouble').addEventListener('click', playerDouble);
    document.getElementById('bjYes').addEventListener('click',()=>{ document.getElementById('bjContinueModal').style.display='none'; resetBlackjackUI(); });
    document.getElementById('bjNo').addEventListener('click',()=>{ document.getElementById('bjContinueModal').style.display='none'; showSection('games'); resetBlackjackUI(true); });

  // ===== ROULETTE =====
let rouletteNumbers = [];
let rouletteInitDone = false;
let rouletteHistory = [];

const straightBets = new Map(); // number -> count
const outsideBets  = new Map(); // type   -> count

const rouletteWheel     = document.getElementById('rouletteWheel');
const rouletteBall      = document.getElementById('rouletteBall');
const rouletteSpinBtn   = document.getElementById('rouletteSpin');
const rouletteClearBtn  = document.getElementById('rouletteClear');
const rouletteResult    = document.getElementById('rouletteResult');
const rouletteHistoryEl = document.getElementById('rouletteHistory');
const rouletteBalanceInfo = document.getElementById('rouletteBalanceInfo');
const rouletteBetInput  = document.getElementById('rouletteBet');

function openRoulette(){
  if (!isLoggedIn) { showNotification('Bitte melde dich an, um Roulette zu spielen.', true); loginModal.style.display='flex'; return; }
  showSection('roulette');
  if (!rouletteInitDone) { initRoulette(); rouletteInitDone = true; }
  updateRouletteBalanceInfo();
  updateSpinButton();
}

function initRoulette(){
  // Farbliste exakt nach EU-Rad
  const REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  rouletteNumbers = Array.from({length:37}, (_,i)=>({number:i, color: i===0 ? 'green' : (REDS.has(i)?'red':'black')}));
  createWheelNumbers();

  // Grid events (Mehrfach-Chips: LMB+1 / RMB-1)
  document.querySelectorAll('.roulette-table-numbers td[data-number]').forEach(cell=>{
    cell.addEventListener('click',     e=>{ e.preventDefault(); addStraight(cell); });
    cell.addEventListener('contextmenu',e=>{ e.preventDefault(); removeStraight(cell); });
  });

  // Outside bets (inkl. Dutzende)
  document.querySelectorAll('.roulette-bet-option').forEach(opt=>{
    opt.addEventListener('click',      e=>{ e.preventDefault(); addOutside(opt); });
    opt.addEventListener('contextmenu',e=>{ e.preventDefault(); removeOutside(opt); });
  });

  rouletteSpinBtn.addEventListener('click', spinRoulette);
  rouletteClearBtn.addEventListener('click', clearAllBets);
  rouletteBetInput.addEventListener('input', updateSpinButton);
}

function createWheelNumbers(){
  rouletteWheel.querySelectorAll('.roulette-number').forEach(n=>n.remove());
  const sequence = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  const RADIUS = 130;
  const orbit  = RADIUS - 18; // Ball-Orbit
  sequence.forEach((num, i)=>{
    const d  = rouletteNumbers[num];
    const a  = (i/sequence.length)*360;
    const el = document.createElement('div');
    el.className = `roulette-number ${d.color}`;
    el.textContent = num;
    el.style.transform = `translate(-50%,-50%) rotate(${a}deg) translate(${RADIUS}px) rotate(-${a}deg)`;
    rouletteWheel.appendChild(el);
  });
  // Ball an Start-Orbit bringen
  rouletteBall.style.transform = `translate(-50%,-50%) rotate(0deg) translate(${orbit}px)`;
}

function addStraight(cell){
  const n = parseInt(cell.dataset.number,10);
  const c = (straightBets.get(n)||0)+1;
  straightBets.set(n,c);
  cell.classList.add('selected-bet');
  incBadge(cell);
  updateSpinButton();
}
function removeStraight(cell){
  const n = parseInt(cell.dataset.number,10);
  if(!straightBets.has(n)) return;
  const left = (straightBets.get(n)||0)-1;
  if(left<=0){ straightBets.delete(n); cell.classList.remove('selected-bet'); }
  decBadge(cell);
  updateSpinButton();
}
function addOutside(opt){
  const k = opt.dataset.bet;
  const c = (outsideBets.get(k)||0)+1;
  outsideBets.set(k,c);
  opt.classList.add('selected-bet');
  incBadge(opt);
  updateSpinButton();
}
function removeOutside(opt){
  const k = opt.dataset.bet;
  if(!outsideBets.has(k)) return;
  const left = (outsideBets.get(k)||0)-1;
  if(left<=0){ outsideBets.delete(k); opt.classList.remove('selected-bet'); }
  decBadge(opt);
  updateSpinButton();
}
function clearAllBets(){
  straightBets.clear(); outsideBets.clear();
  document.querySelectorAll('.chip-badge').forEach(b=>b.remove());
  document.querySelectorAll('.selected-bet').forEach(e=>e.classList.remove('selected-bet'));
  updateSpinButton();
}
function incBadge(el){
  let b = el.querySelector('.chip-badge');
  if(!b){ b=document.createElement('div'); b.className='chip-badge'; b.textContent='0'; el.appendChild(b); }
  b.textContent = String(parseInt(b.textContent,10)+1);
}
function decBadge(el){
  const b = el.querySelector('.chip-badge');
  if(!b) return;
  const next = parseInt(b.textContent,10)-1;
  if(next<=0) b.remove(); else b.textContent=String(next);
}

function updateRouletteBalanceInfo(){
  rouletteBalanceInfo.textContent = currentUser ? `Kontostand: €${(currentUser.balance||0).toFixed(2)}` : '';
}
function updateSpinButton(){
  const a = parseInt(rouletteBetInput.value)||0;
  const chips = [...straightBets.values(), ...outsideBets.values()].reduce((s,v)=>s+v,0);
  rouletteSpinBtn.disabled = !(a>0 && chips>0 && currentUser && currentUser.balance >= a*chips);
}

function spinRoulette(){
  const chipVal = parseInt(rouletteBetInput.value)||0;
  const chips   = [...straightBets.values(), ...outsideBets.values()].reduce((s,v)=>s+v,0);
  if(chipVal<=0 || chips===0){ showNotification('Bitte Einsatz & Wette wählen', true); return; }
  const totalBet = chipVal*chips;
  if(currentUser.balance < totalBet){ showNotification('Nicht genügend Guthaben', true); return; }

  currentUser.balance -= totalBet;
  persistCurrentUser(); updateRouletteBalanceInfo(); updateSpinButton();

  const sequence = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  const segments = sequence.length;
  const idx      = Math.floor(Math.random()*segments);
  const winner   = sequence[idx];

  // Segment-Winkel
  const segAngle = 360/segments;
  const targetAngle = idx*segAngle;

  // Orbit für Ball
  const RADIUS = 130, orbit = RADIUS-18;

  // Anzahl Umdrehungen
  const wheelTurns = 6;   // Rad
  const ballTurns  = 14;  // Ball (gegenläufig)

  // Reset
  rouletteWheel.style.transition = 'none';
  rouletteBall .style.transition = 'none';
  rouletteWheel.style.transform  = 'rotate(0deg)';
  rouletteBall .style.transform  = `translate(-50%,-50%) rotate(0deg) translate(${orbit}px)`;

  // Nächstes Frame
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    // Übergangsdauer
    rouletteWheel.style.transition = 'transform 4s cubic-bezier(0.2,0.8,0.2,1)';
    rouletteBall .style.transition = 'transform 4s cubic-bezier(0.2,0.8,0.2,1)';

    // Rad dreht vorwärts
    const wheelEnd = 360*wheelTurns;
    rouletteWheel.style.transform = `rotate(${wheelEnd}deg)`;

    // Ball dreht schneller rückwärts + stoppt am Gewinner
    const ballEnd = -(360*ballTurns) - targetAngle;
    rouletteBall.style.transform = `translate(-50%,-50%) rotate(${ballEnd}deg) translate(${orbit}px)`;
  }));

  // Abrechnung nach der Animation
  setTimeout(()=>{ settleRoulette(winner, totalBet, chipVal); }, 4200);
}


function settleRoulette(winner, totalBet, chipVal){
  addToHistoryView(winner);

  let winnings = 0;

  // Straight 35:1 (36x inkl. Einsatz)
  straightBets.forEach((cnt, n)=>{ if(n===winner) winnings += cnt * chipVal * 36; });

  // Outside: 1:1 bzw. Dutzende 2:1
  outsideBets.forEach((cnt, type)=>{
    if(outsideWins(type, winner)){
      winnings += cnt * chipVal * (type.endsWith('12') ? 3 : 2);
    }
  });

  if(winnings>0){ currentUser.balance += winnings; persistCurrentUser(); updateRouletteBalanceInfo(); }

  const net = winnings - totalBet;
  let txt = `Zahl: ${winner} – `;
  if(net>0) txt += `Gewinn: €${net.toFixed(2)}`;
  else if(net<0) txt += `Verlust: €${Math.abs(net).toFixed(2)}`;
  else txt += 'Break-even';
  rouletteResult.textContent = txt;
  showNotification(txt);

  // Transitions zurücksetzen
  setTimeout(()=>{ rouletteWheel.style.transition='none'; rouletteBall.style.transition='none'; }, 250);

  // Einsätze bleiben liegen (wie am Tisch). Löschen: Button.
  updateSpinButton();
}

function outsideWins(type, n){
  if(n===0) return false;
  switch(type){
    case 'red':   return rouletteNumbers[n].color==='red';
    case 'black': return rouletteNumbers[n].color==='black';
    case 'even':  return n%2===0;
    case 'odd':   return n%2===1;
    case '1st12': return n>=1 && n<=12;
    case '2nd12': return n>=13 && n<=24;
    case '3rd12': return n>=25 && n<=36;
    default: return false;
  }
}

function addToHistoryView(n){
  rouletteHistory.unshift({number:n, color: rouletteNumbers[n].color});
  if(rouletteHistory.length>10) rouletteHistory.pop();
  rouletteHistoryEl.innerHTML='';
  rouletteHistory.forEach(item=>{
    const el=document.createElement('div');
    el.className=`roulette-history-item ${item.color}`;
    el.textContent=item.number;
    rouletteHistoryEl.appendChild(el);
  });
}

// Slots Game Variablen
let slotsSpinning = false;
let slotsBalance = 1000;
let slotsWin = 0;
let slotsSymbols = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣'];
let slotsPaytable = {
  '🍒🍒🍒': 10,
  '🍋🍋🍋': 20,
  '🍊🍊🍊': 30,
  '🍇🍇🍇': 40,
  '🔔🔔🔔': 50,
  '💎💎💎': 75,
  '7️⃣7️⃣7️⃣': 100
};

// Slots Game Funktionen
function openSlots() {
  if (!isLoggedIn) {
    showNotification('Bitte melde dich an, um die Slots zu spielen.', true);
    loginModal.style.display = 'flex';
    return;
  }
  // Alle Sektionen verstecken
  document.querySelectorAll('.page-section').forEach(section => {
    section.style.display = 'none';
  });
  
  // Slots-Sektion anzeigen
  document.getElementById('slots-section').style.display = 'block';
  
  // Navigation aktualisieren
  updateNavIndicator('Slots');
  
  // Benachrichtigung anzeigen
  showNotification('Diamond Casino Slots geladen');
  
  // Balance-Info aktualisieren
  updateSlotsBalanceInfo();
}

function updateSlotsBalanceInfo() {
  if (currentUser) {
    slotsBalance = currentUser.balance;
    document.getElementById('slotsBalanceInfo').textContent = `Kontostand: €${slotsBalance.toFixed(2)}`;
    document.getElementById('slotsCredits').textContent = Math.floor(slotsBalance);
  }
}

function spinSlots() {
  if (slotsSpinning) return;
  
  const bet = parseInt(document.getElementById('slotsBet').value) || 5;
  if (bet <= 0) {
    showNotification('Bitte einen Einsatz > 0 setzen', true);
    return;
  }
  
  if (slotsBalance < bet) {
    showNotification('Nicht genügend Guthaben', true);
    return;
  }
  
  // Einsatz abziehen
  slotsBalance -= bet;
  if (currentUser) {
    currentUser.balance = slotsBalance;
    persistCurrentUser();
  }
  updateSlotsBalanceInfo();
  
  // Spin-Animation starten
  slotsSpinning = true;
  document.getElementById('slotsSpin').disabled = true;
  
  const reels = [
    document.getElementById('reel1'),
    document.getElementById('reel2'),
    document.getElementById('reel3')
  ];
  
  // Alle Walzen zum Spinnen bringen
  reels.forEach(reel => {
    reel.classList.add('spinning');
    reel.querySelectorAll('.symbol').forEach(sym => {
      sym.textContent = slotsSymbols[Math.floor(Math.random() * slotsSymbols.length)];
    });
  });
  
  // Nach unterschiedlicher Zeit anhalten (wie echte Slotmaschine)
  setTimeout(() => stopReel(reels[0], checkResult), 1000 + Math.random() * 500);
  setTimeout(() => stopReel(reels[1], checkResult), 1500 + Math.random() * 500);
  setTimeout(() => stopReel(reels[2], checkResult), 2000 + Math.random() * 500);
}

function stopReel(reel, callback) {
  reel.classList.remove('spinning');
  
  // Zufällige Symbole für die Anzeige setzen
  const symbols = reel.querySelectorAll('.symbol');
  symbols.forEach(sym => {
    sym.textContent = slotsSymbols[Math.floor(Math.random() * slotsSymbols.length)];
  });
  
  if (callback) callback();
}

function checkResult() {
  // Prüfen ob alle Walzen angehalten haben
  const spinningReels = document.querySelectorAll('.reel.spinning');
  if (spinningReels.length > 0) return;
  
  slotsSpinning = false;
  document.getElementById('slotsSpin').disabled = false;
  
  // Ergebnis auslesen
  const reels = [
    document.getElementById('reel1'),
    document.getElementById('reel2'),
    document.getElementById('reel3')
  ];
  
  const middleRow = [];
  reels.forEach(reel => {
    const symbols = reel.querySelectorAll('.symbol');
    middleRow.push(symbols[1].textContent);
  });
  
  const result = middleRow.join('');
  
  // Gewinn berechnen
  let winMultiplier = 0;
  for (const [pattern, multiplier] of Object.entries(slotsPaytable)) {
    if (result === pattern) {
      winMultiplier = multiplier;
      break;
    }
  }
  
  const bet = parseInt(document.getElementById('slotsBet').value) || 5;
  const winAmount = winMultiplier * bet;
  
  if (winMultiplier > 0) {
    // Gewinnanimation
    highlightWin();
    
    // Gewinn auszahlen
    slotsBalance += winAmount;
    slotsWin = winAmount;
    
    if (currentUser) {
      currentUser.balance = slotsBalance;
      persistCurrentUser();
    }
    
    showNotification(`Gewonnen! ${result} = ${winMultiplier}x Einsatz!`);
  } else {
    slotsWin = 0;
    showNotification('Kein Gewinn. Versuchen Sie es erneut!');
  }
  
  updateSlotsBalanceInfo();
  document.getElementById('slotsWin').textContent = slotsWin;
}

function highlightWin() {
  const payline = document.createElement('div');
  payline.className = 'payline middle';
  document.querySelector('.slots-paylines').appendChild(payline);
  
  setTimeout(() => {
    payline.style.opacity = '1';
  }, 100);
  
  setTimeout(() => {
    payline.style.opacity = '0';
    setTimeout(() => {
      payline.remove();
  }, 1000);
  }, 2000);
}

function setMaxBet() {
  document.getElementById('slotsBet').value = Math.min(100, Math.floor(slotsBalance));
}

// Event-Listener für Slots
document.addEventListener('DOMContentLoaded', function() {
  const slotsSpinBtn = document.getElementById('slotsSpin');
  const slotsMaxBetBtn = document.getElementById('slotsMaxBet');
  
  if (slotsSpinBtn) {
    slotsSpinBtn.addEventListener('click', spinSlots);
  }
  
  if (slotsMaxBetBtn) {
    slotsMaxBetBtn.addEventListener('click', setMaxBet);
  }
});

// Globale Funktion für den Aufruf aus HTML
window.openSlots = openSlots;

    // ===== PLINKO =====
let plinkoConfig = { rows: 12, difficulty: 'medium' }; // easy=8, medium=12, hard=16
let plinkoPegMap = [];         // Peg-Koordinaten pro Reihe
let plinkoSlotPayouts = [];    // Multiplikatoren je Slot (Array-Länge rows+1)
const plinkoBoardEl = document.getElementById('plinkoBoard');
const plinkoSlotsEl = document.getElementById('plinkoSlots');
const plinkoDropBtn = document.getElementById('plinkoDrop');
const plinkoBetInput = document.getElementById('plinkoBet');
const plinkoDifficultySel = document.getElementById('plinkoDifficulty');
const plinkoResultEl = document.getElementById('plinkoResult');
const plinkoHistoryEl = document.getElementById('plinkoHistory');
const plinkoBalanceInfo = document.getElementById('plinkoBalanceInfo');

function openPlinko(){
  if(!isLoggedIn){
    showNotification('Bitte melde dich an, um Plinko zu spielen.', true);
    loginModal.style.display='flex';
    return;
  }
  showSection('plinko');
  updatePlinkoBalanceInfo();
  // Defaults laden
  const diff = plinkoDifficultySel.value || 'medium';
  applyPlinkoDifficulty(diff);
  buildPlinkoBoard();
}

function updatePlinkoBalanceInfo(){
  plinkoBalanceInfo.textContent = currentUser ? `Kontostand: €${(currentUser.balance||0).toFixed(2)}` : '';
}

plinkoDifficultySel.addEventListener('change', (e)=>{
  applyPlinkoDifficulty(e.target.value);
  buildPlinkoBoard();
});

function applyPlinkoDifficulty(diff){
  plinkoConfig.difficulty = diff;
  plinkoConfig.rows = (diff==='easy') ? 8 : (diff==='hard' ? 16 : 12);
  plinkoSlotPayouts = getPayoutsFor(plinkoConfig.rows, diff); // Array Länge rows+1
}

function getPayoutsFor(rows, diff){
  // Symmetrische Multiplikatoren (ähnlich gängigen Plinko-Spielen).
  // Kanten = höchste Gewinne, Mitte = kleine Gewinne; je schwieriger, desto steiler.
  const slots = rows + 1;
  let base;
  if(diff==='easy'){
    // z.B. 8 Reihen -> 9 Slots (kleinere Varianz)
    base = [3.3, 2, 1.2, 0.8, 0.6]; // gespiegelt zu voller Länge
  } else if(diff==='hard'){
    base = [40, 15, 3.8, 1.8, 1.2, 1, 0.6]; // steiler
  } else {
    base = [11, 4, 2, 1.4, 1.1, 0.6]; // medium
  }
  // Skaliere/strecke das Muster auf gewünschte Slot-Anzahl und spiegle
  // Wir erzeugen eine glatte Kurve (links->Mitte) und spiegeln nach rechts.
  const leftLen = Math.ceil(slots/2);
  const curve = [];
  for(let i=0;i<leftLen;i++){
    const t = i/(leftLen-1); // 0..1 zur Interpolation
    // Interpolieren zwischen Hoch->Mitte anhand base
    const idx = Math.floor(t*(base.length-1));
    const frac = (t*(base.length-1)) - idx;
    const v = base[idx]*(1-frac) + base[Math.min(idx+1,base.length-1)]*frac;
    curve.push(+v.toFixed(2));
  }
  // Spiegeln ohne die Mitte doppelt zu nehmen
  const right = curve.slice(0, slots-leftLen).reverse();
  const payouts = curve.concat(right);

  // Leicht: Gewinne flacher (cap nach oben)
  if(diff==='easy'){
    return payouts.map(v => Math.min(v, 4.0));
  }
  // Schwer: etwas mehr Edge-Power
  if(diff==='hard'){
    return payouts.map((v,i,arr)=>{
      if(i===0 || i===arr.length-1) return Math.max(v, 33);
      if(i===1 || i===arr.length-2) return Math.max(v, 11);
      return v;
    });
  }
  return payouts;
}

function buildPlinkoBoard(){
  // Board leeren
  plinkoBoardEl.innerHTML='';
  plinkoSlotsEl.innerHTML='';
  plinkoResultEl.textContent='';
  plinkoHistoryEl.innerHTML='';

  const rows = plinkoConfig.rows;
  plinkoBoardEl.style.setProperty('--rows', rows);
  plinkoSlotsEl.style.setProperty('--plinko-slots', rows+1);

  // Geometrie
  const W = plinkoBoardEl.clientWidth || 640;
  const H = plinkoBoardEl.clientHeight || 560;
  const topPad = 30;
  const bottomPad = 60;
  const usableH = H - topPad - bottomPad;
  const rowGap = usableH / (rows+1); // Abstände vertikal
  const colGap = (W - 60) / rows;    // horizontale Schrittweite
  const leftPad = 30;

  plinkoPegMap = [];

  // Pegs erzeugen (Dreiecks-Gitter)
  for(let r=0;r<rows;r++){
    const y = topPad + (r+1)*rowGap;
    const cols = r+1;
    plinkoPegMap[r] = [];
    for(let c=0;c<cols;c++){
      const x = leftPad + (W-2*leftPad)/2 - (r*colGap)/2 + c*colGap;
      plinkoPegMap[r][c] = {x,y};
      const peg = document.createElement('div');
      peg.className='plinko-peg';
      peg.style.left = `${x}px`;
      peg.style.top  = `${y}px`;
      plinkoBoardEl.appendChild(peg);
    }
  }

  // Slots mit Payout-Badges
  const payouts = plinkoSlotPayouts;
  for(let s=0;s<rows+1;s++){
    const badge = document.createElement('div');
    badge.className='plinko-slot ' + slotClassFor(payouts[s], s, rows);
    badge.textContent = `${payouts[s].toFixed(1)}×`;
    plinkoSlotsEl.appendChild(badge);
  }
}

function slotClassFor(mult, idx, rows){
  if(idx===0||idx===rows) return 'edge';
  if(mult>=4) return 'high';
  if(mult>=1.2) return 'mid';
  return 'low';
}

plinkoDropBtn.addEventListener('click', dropPlinkoBall);

function dropPlinkoBall(){
  const bet = parseInt(plinkoBetInput.value,10) || 0;
  if(bet<=0){ showNotification('Bitte einen Einsatz > 0 setzen', true); return; }
  if(!currentUser || currentUser.balance < bet){ showNotification('Nicht genügend Guthaben', true); return; }

  // Einsatz abziehen
  currentUser.balance -= bet; persistCurrentUser(); updatePlinkoBalanceInfo();

  // Ball erzeugen (Start oben Mitte)
  const ball = document.createElement('div');
  ball.className='plinko-ball';
  plinkoBoardEl.appendChild(ball);

  const rows = plinkoConfig.rows;
  const W = plinkoBoardEl.clientWidth || 640;
  const topStart = 18;
  let x = W/2;
  let y = topStart;

  ball.style.left = `${x}px`;
  ball.style.top  = `${y}px`;

  // Pfad simulieren: an jeder Reihe links/rechts (50/50)
  // Schwierigkeit beeinflusst NUR Payouts/Board-Größe (wie gewünscht).
  let position = 0; // Linksverschiebungen minus Rechtsverschiebungen (zur Slot-Bestimmung)
  let colIdx = 0;   // "c" an der Reihe (für horizontale Schrittweite)
  const horizStep = (plinkoPegMap[plinkoPegMap.length-1][1]?.x || (W/2+40)) - (plinkoPegMap[plinkoPegMap.length-1][0]?.x || (W/2-40));

  let r = -1;
  const timer = setInterval(()=>{
    r++;
    if(r >= rows){
      clearInterval(timer);
      // Slot index aus Position ermitteln: Mitte + position
      const slotIndex = Math.min(Math.max(Math.floor((rows+1)/2 + position), 0), rows);
      const mult = plinkoSlotPayouts[slotIndex] || 0;
      const winnings = +(bet * mult).toFixed(2);
      if(winnings>0){ currentUser.balance += winnings; persistCurrentUser(); updatePlinkoBalanceInfo(); }
      const net = winnings - bet;
      const text = `Slot: ${slotIndex} – Multiplikator ${mult.toFixed(1)}× – ` + (net>=0 ? `Gewinn: €${net.toFixed(2)}` : `Verlust: €${Math.abs(net).toFixed(2)}`);
      plinkoResultEl.textContent = text;
      showNotification(text);
      addPlinkoHistory(slotIndex, mult, net);
      // sanft unten "liegenlassen"
      setTimeout(()=>{ ball.remove(); }, 900);
      return;
    }

    // Ziel-Peg (Mitte der Reihe): entscheiden L/R und animieren dahin
    const drift = (Math.random()<0.5) ? -1 : 1;
    position += (drift>0 ? 0 : -0) + (drift===-1 ? -0.5 : 0.5); // feinere Mitte
    colIdx = Math.max(0, Math.min(r, Math.round((r/2) + position)));
    const peg = plinkoPegMap[r][Math.max(0, Math.min(colIdx, r))];
    // Bewegung Richtung Peg
    animateTo(ball, peg.x, peg.y, 140, ()=>{
      // Nach „Abprall“ horizontal leicht versetzen
      const nx = peg.x + drift * (horizStep/2 - 2);
      const ny = peg.y + ((plinkoPegMap[1]?.[0]?.y ? (plinkoPegMap[1][0].y - (plinkoPegMap[0]?.[0]?.y||peg.y)) : 28) * 0.8);
      animateTo(ball, nx, ny, 120);
    });
  }, 160);
}

function animateTo(el, targetX, targetY, duration=120, cb){
  const startX = parseFloat(el.style.left);
  const startY = parseFloat(el.style.top);
  const dx = targetX - startX;
  const dy = targetY - startY;
  const start = performance.now();
  function step(now){
    const t = Math.min(1, (now-start)/duration);
    const ease = t<.5 ? 2*t*t : -1+(4-2*t)*t; // easeInOut
    el.style.left = (startX + dx*ease) + 'px';
    el.style.top  = (startY + dy*ease) + 'px';
    if(t<1) requestAnimationFrame(step); else if(cb) cb();
  }
  requestAnimationFrame(step);
}

function addPlinkoHistory(slot, mult, net){
  const chip = document.createElement('div');
  chip.className='plinko-history-item';
  chip.textContent = `Slot ${slot} • ${mult.toFixed(1)}× • ${net>=0?'+':''}${net.toFixed(2)}€`;
  plinkoHistoryEl.prepend(chip);
  // max 10
  if(plinkoHistoryEl.childElementCount>10){
    plinkoHistoryEl.removeChild(plinkoHistoryEl.lastChild);
  }
}

// Expose
window.openPlinko = openPlinko;