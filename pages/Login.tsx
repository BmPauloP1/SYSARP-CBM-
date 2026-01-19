
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '../services/base44Client';
import { Card, Button, Input, Select } from '../components/ui_components';
import { Lock, UserPlus, Shield, AlertTriangle, LogIn, Mail, KeyRound, CheckSquare, X, FileText, UserCog, Database, Copy, CheckCircle, User } from 'lucide-react';
import { ORGANIZATION_CHART, LGPD_TERMS, SYSARP_LOGO } from '../types';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  
  const [logoError, setLogoError] = useState(false);

  // States for Modals
  const [showRegister, setShowRegister] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState<any>(null);
  const [showLgpdModal, setShowLgpdModal] = useState(false);
  
  const [emailFixSql, setEmailFixSql] = useState<string | null>(null);
  
  // Registration Form State
  const [regForm, setRegForm] = useState({
      full_name: '',
      phone: '',
      sarpas_code: '',
      crbm: '',
      unit: '',
      license: '',
      password: '',
      confirmPassword: '',
      terms_accepted: false
  });
  const [regEmailPrefix, setRegEmailPrefix] = useState('');

  // Change Password State
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changePasswordTermsAccepted, setChangePasswordTermsAccepted] = useState(false);

  // Filtra o input do usuário conforme regras institucionais
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Permite letras, números, ponto, sublinhado e hífen. Bloqueia @ e outros símbolos.
    const filteredValue = value.replace(/[^a-z0-9._-]/gi, '').toLowerCase();
    setUsername(filteredValue);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');

    try {
      // Concatena o domínio institucional de forma invisível
      const fullEmail = `${username}@cbm.pr.gov.br`;
      
      const user = await base44.auth.login(fullEmail, password);
      
      if (user?.change_password_required) {
        setShowChangePassword(user);
      } else {
        navigate('/');
      }
    } catch (err: any) {
      console.error("Login error:", err);
      // Mensagem genérica conforme regra de segurança
      setLoginError("Usuário ou senha inválidos.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regForm.password !== regForm.confirmPassword) {
      alert("As senhas não coincidem.");
      return;
    }
    if (!regForm.terms_accepted) {
      alert("Você deve aceitar os Termos de Uso e a Política de Privacidade.");
      return;
    }

    setLoading(true);
    try {
      const fullEmail = `${regEmailPrefix}@cbm.pr.gov.br`;
      
      await base44.auth.createAccount({
        ...regForm,
        full_name: regForm.full_name,
        email: fullEmail,
      });

      alert("Solicitação de cadastro enviada! Faça o login com o seu usuário e senha criados.");
      setShowRegister(false);
      
      setRegForm({
        full_name: '', phone: '', sarpas_code: '', crbm: '', unit: '', license: '',
        password: '', confirmPassword: '', terms_accepted: false
      });
      setRegEmailPrefix('');

    } catch (err: any) {
      alert(`Erro no cadastro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (newPassword !== confirmNewPassword) {
        alert("As senhas não coincidem.");
        return;
      }
      if (!changePasswordTermsAccepted) {
        alert("Você deve aceitar os Termos de Uso e a Política de Privacidade para prosseguir.");
        return;
      }

      setLoading(true);
      try {
        await base44.auth.changePassword(showChangePassword.id, newPassword);
        alert("Senha alterada com sucesso! Você será redirecionado para o Dashboard.");
        navigate('/');
      } catch (err) {
        alert("Erro ao alterar senha.");
      } finally {
        setLoading(false);
      }
  };

  const copySqlToClipboard = (text: string | null) => {
    if (text) {
      navigator.clipboard.writeText(text);
      alert("Código SQL copiado para a área de transferência!");
    }
  };


  return (
    <div className="h-[100dvh] w-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-900 via-slate-950 to-black flex flex-col items-center justify-center p-4 overflow-hidden relative font-sans text-slate-800">
      
      {/* AIRDATA SAFETY BADGE - Hidden on small mobile to save space */}
      <div className="absolute top-6 left-6 z-[100] opacity-60 hover:opacity-100 transition-all hover:scale-105 hidden md:block grayscale hover:grayscale-0 duration-500">
        <a href='https://certificates.airdata.com/QcvFJL' target="_blank" rel="noopener noreferrer" title="Airdata UAV Safety Verified">
          <img 
            alt='Airdata UAV|Drone Safety Verified Badge' 
            src='https://certificates.airdata.com/badge?i=QcvFJL&r=Hnhr&t=7&m=3&size=12&c=0' 
            className="w-[180px] md:w-[240px] h-auto drop-shadow-2xl"
            style={{ imageRendering: 'smooth' }}
          />
        </a>
      </div>

      {/* EMAIL FIX MODAL */}
      {emailFixSql && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
           <Card className="w-full max-w-3xl flex flex-col bg-white border-l-4 border-amber-500 shadow-2xl rounded-2xl overflow-hidden">
              <div className="p-5 bg-gradient-to-r from-amber-500 to-amber-600 text-white flex justify-between items-center">
                 <h3 className="font-bold text-lg flex items-center gap-2">
                   <LogIn className="w-6 h-6" />
                   Ação Administrativa Necessária
                 </h3>
                 <button onClick={() => setEmailFixSql(null)} className="hover:bg-white/20 p-1.5 rounded-full transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                 <p className="text-slate-700 font-medium">
                    Ajuste técnico de banco de dados requerido para validação de e-mails institucionais.
                 </p>
                 <div className="relative group">
                    <pre className="bg-slate-900 text-green-400 p-5 rounded-xl text-xs overflow-x-auto font-mono border border-slate-700 max-h-64 shadow-inner">
                       {emailFixSql}
                    </pre>
                    <button onClick={() => copySqlToClipboard(emailFixSql)} className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white p-2 rounded transition-colors opacity-0 group-hover:opacity-100"><Copy className="w-4 h-4" /></button>
                 </div>
              </div>
              <div className="p-4 bg-slate-50 border-t flex justify-end gap-3">
                 <Button variant="outline" onClick={() => setEmailFixSql(null)}>Fechar</Button>
                 <Button onClick={() => copySqlToClipboard(emailFixSql)} className="bg-amber-600 text-white hover:bg-amber-700 font-bold"><Copy className="w-4 h-4 mr-2" /> Copiar SQL</Button>
              </div>
           </Card>
        </div>
      )}

      {/* LGPD Modal */}
      {showLgpdModal && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
           <Card className="max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col bg-white rounded-2xl shadow-2xl">
              <div className="p-5 border-b flex justify-between items-center bg-slate-50">
                 <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                   <FileText className="w-5 h-5 text-red-600" />
                   Política de Privacidade e Termos de Uso
                 </h3>
                 <button onClick={() => setShowLgpdModal(false)} className="p-1.5 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
              </div>
              <div className="p-8 overflow-y-auto text-sm text-slate-600 whitespace-pre-line leading-relaxed bg-white text-justify">
                 {LGPD_TERMS}
              </div>
              <div className="p-5 border-t bg-slate-50 flex justify-end">
                 <Button onClick={() => setShowLgpdModal(false)} className="bg-slate-800 hover:bg-slate-900 text-white font-bold">Fechar</Button>
              </div>
           </Card>
        </div>
      )}

      {/* Main Content */}
      <div className="w-full max-w-[400px] flex flex-col gap-3 md:gap-6 relative z-10 my-auto">
        
        {/* Header Logo */}
        <div className="text-center">
           {/* Logo SYSARP - Tamanho Aumentado com Efeitos de Destaque */}
           <div className="relative w-36 h-36 md:w-48 md:h-48 mx-auto mb-2 md:mb-6 group">
              {/* Efeito de Glow Externo Intenso */}
              <div className="absolute inset-0 bg-red-600 rounded-full blur-3xl opacity-40 group-hover:opacity-60 transition-opacity duration-700 animate-pulse"></div>
              
              {/* Container da Logo (Vidro, Borda e Sombra) */}
              <div className="relative w-full h-full bg-gradient-to-b from-white/10 to-transparent backdrop-blur-xl rounded-full flex items-center justify-center shadow-2xl border border-white/20 ring-1 ring-red-500/30 p-4 transform transition-all duration-500 hover:scale-105 hover:border-red-500/50">
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/696c235cd3c7dd9b211e6fa5/ef1f7eb49_9d6d0ab9-baa7-46f6-ad3c-0def22bac6e8.png" 
                  alt="SYSARP Logo CBMPR"
                  className="w-full h-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)] filter brightness-110"
                />
              </div>
           </div>
           <h1 className="text-3xl md:text-4xl font-black text-white tracking-[0.2em] uppercase drop-shadow-md">SYSARP</h1>
           <p className="text-red-200/80 text-[10px] font-bold uppercase tracking-[0.3em] mt-1 md:mt-2">Sistema de Aeronaves Remotamente Pilotadas</p>
        </div>

        {/* Login Card - Compactado para Mobile */}
        <Card className="p-6 md:p-8 shadow-2xl bg-white/95 backdrop-blur-xl border border-white/40 rounded-3xl relative overflow-hidden">
          {/* Top Decorative Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-700 via-red-500 to-red-700"></div>

          <form onSubmit={handleLogin} className="space-y-4 md:space-y-6 mt-1">
            <div className="text-center pb-1">
               <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wide">Acesso Restrito</h2>
               <p className="text-xs text-slate-400 font-medium mt-0.5">Corpo de Bombeiros Militar do Paraná</p>
            </div>

            {loginError && (
              <div className="bg-red-50 border-l-4 border-red-500 rounded-r-lg p-2.5 flex items-start gap-2 animate-fade-in shadow-sm">
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span className="text-xs font-bold text-red-800 leading-tight">{loginError}</span>
              </div>
            )}

            <div className="space-y-3 md:space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase ml-1">Usuário</label>
                <div className="relative group">
                  <Input 
                    value={username} 
                    onChange={handleUsernameChange} 
                    placeholder="nome.sobrenome"
                    type="text"
                    required
                    autoComplete="username"
                    className="pl-10 h-11 md:h-12 bg-slate-50 border-slate-200 focus:bg-white focus:border-red-500 focus:ring-red-500/20 transition-all rounded-xl lowercase font-medium text-slate-700 placeholder:text-slate-400 text-sm"
                  />
                  <div className="absolute left-3 top-2.5 md:top-3 text-slate-400 group-focus-within:text-red-600 transition-colors pointer-events-none">
                    <User className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase ml-1">Senha</label>
                <div className="relative group">
                  <Input 
                    type="password"
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="pl-10 h-11 md:h-12 bg-slate-50 border-slate-200 focus:bg-white focus:border-red-500 focus:ring-red-500/20 transition-all rounded-xl font-medium text-slate-700 placeholder:text-slate-400 text-sm"
                  />
                  <div className="absolute left-3 top-2.5 md:top-3 text-slate-400 group-focus-within:text-red-600 transition-colors pointer-events-none">
                    <Lock className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 md:pt-4 space-y-2 md:space-y-3">
               <Button type="submit" disabled={loading} className="w-full h-11 md:h-12 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-800 hover:to-red-700 text-white font-bold text-xs md:text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-red-900/20 transform active:scale-[0.98] transition-all">
                  {loading ? (
                    <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Acessando...</div>
                  ) : (
                    <><LogIn className="w-4 h-4 md:w-5 md:h-5 mr-2" /> Entrar no Sistema</>
                  )}
               </Button>
               <Button type="button" variant="outline" className="w-full h-11 md:h-12 border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-xl font-bold text-[10px] md:text-xs uppercase tracking-wider transition-all" onClick={() => setShowRegister(true)}>
                  <UserPlus className="w-4 h-4 mr-2"/> Solicitar Acesso
               </Button>
            </div>
          </form>
        </Card>
        
        {/* Footer Credits */}
        <div className="text-center space-y-2 opacity-70 hover:opacity-100 transition-opacity duration-500 pt-2">
           <p className="text-white/80 text-[10px] font-bold tracking-wide">© 2026 SYSARP - CBMPR - V.1.2</p>
           <div className="flex flex-col gap-0.5">
               <p className="text-red-400 text-[9px] uppercase tracking-widest font-black">Desenvolvimento</p>
               <p className="text-white/50 text-[9px] uppercase tracking-wider font-medium">Cap. QOBM Jackson</p>
               <p className="text-white/50 text-[9px] uppercase tracking-wider font-medium">Cb. QPBM Paulo</p>
           </div>
        </div>
      </div>

      {/* --- MODAL DE CADASTRO --- */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 animate-fade-in">
          <Card className="w-full max-w-2xl p-0 shadow-2xl rounded-2xl overflow-hidden bg-white max-h-[90vh] flex flex-col">
            <div className="bg-slate-900 p-5 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-bold text-white flex items-center gap-3">
                <div className="bg-white/10 p-2 rounded-lg"><UserPlus className="w-5 h-5 text-blue-400" /></div>
                Solicitar Cadastro de Piloto
              </h2>
              <button onClick={() => setShowRegister(false)} className="text-slate-400 hover:text-white hover:bg-white/10 p-2 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 md:p-8">
              <form onSubmit={handleRegister} className="space-y-5">
                
                <div className="w-full">
                    <Input 
                      label="Nome Completo" 
                      value={regForm.full_name} 
                      onChange={e => setRegForm({...regForm, full_name: e.target.value})}
                      placeholder="Ex: João Pereira"
                      required
                      className="bg-slate-50 border-slate-200 h-11"
                      labelClassName="text-xs font-bold text-slate-500 uppercase ml-1 mb-1"
                    />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Identificador de Usuário</label>
                  <div className="flex items-center border border-slate-200 bg-slate-50 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all h-11">
                    <input 
                      className="flex-1 text-right bg-transparent border-none outline-none px-3 text-slate-700 placeholder:text-slate-400 lowercase font-medium h-full" 
                      placeholder="nome.sobrenome"
                      value={regEmailPrefix}
                      onChange={e => setRegEmailPrefix(e.target.value.replace(/[^a-z0-9._-]/gi, '').toLowerCase())}
                      required
                    />
                    <span className="bg-slate-100 px-4 h-full flex items-center text-slate-500 border-l border-slate-200 text-sm font-medium">@cbm.pr.gov.br</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Telefone" value={regForm.phone} onChange={e => setRegForm({...regForm, phone: e.target.value})} placeholder="(41) 99999-9999" required className="bg-slate-50 border-slate-200 h-11" labelClassName="text-xs font-bold text-slate-500 uppercase ml-1 mb-1" />
                  <Input label="Código SARPAS" value={regForm.sarpas_code} onChange={e => setRegForm({...regForm, sarpas_code: e.target.value})} placeholder="BR-XXXXXX" required className="bg-slate-50 border-slate-200 h-11" labelClassName="text-xs font-bold text-slate-500 uppercase ml-1 mb-1" />
                </div>

                <div className="p-5 bg-blue-50/50 rounded-xl border border-blue-100">
                   <h3 className="text-xs font-black text-blue-800 uppercase mb-3 flex items-center gap-2"><Map className="w-4 h-4"/> Lotação Operacional</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Select label="CRBM" value={regForm.crbm} onChange={e => setRegForm({...regForm, crbm: e.target.value, unit: ''})} required className="bg-white border-blue-200 h-11" labelClassName="text-xs font-bold text-blue-700 uppercase ml-1 mb-1">
                         <option value="">Selecione o CRBM</option>
                         {Object.keys(ORGANIZATION_CHART).map(crbm => <option key={crbm} value={crbm}>{crbm}</option>)}
                      </Select>
                      <Select label="Unidade (BBM/CIBM/BOA)" value={regForm.unit} disabled={!regForm.crbm} onChange={e => setRegForm({...regForm, unit: e.target.value})} className="bg-white border-blue-200 h-11" labelClassName="text-xs font-bold text-blue-700 uppercase ml-1 mb-1">
                         <option value="">Selecione a Unidade</option>
                         {regForm.crbm && ORGANIZATION_CHART[regForm.crbm as keyof typeof ORGANIZATION_CHART]?.map((unit: string) => <option key={unit} value={unit}>{unit}</option>)}
                      </Select>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Senha" type="password" value={regForm.password} onChange={e => setRegForm({...regForm, password: e.target.value})} required className="bg-slate-50 border-slate-200 h-11" labelClassName="text-xs font-bold text-slate-500 uppercase ml-1 mb-1" />
                  <Input label="Confirmar Senha" type="password" value={regForm.confirmPassword} onChange={e => setRegForm({...regForm, confirmPassword: e.target.value})} required className="bg-slate-50 border-slate-200 h-11" labelClassName="text-xs font-bold text-slate-500 uppercase ml-1 mb-1" />
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input type="checkbox" className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-slate-300 shadow-sm checked:border-blue-600 checked:bg-blue-600 transition-all" checked={regForm.terms_accepted} onChange={e => setRegForm({...regForm, terms_accepted: e.target.checked})} />
                      <CheckCircle className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" />
                    </div>
                    <span className="text-sm text-slate-600 leading-snug group-hover:text-slate-800 transition-colors">
                      Li e concordo com a <button type="button" onClick={() => setShowLgpdModal(true)} className="font-bold text-blue-600 hover:text-blue-800 hover:underline">Política de Privacidade e Termos de Uso</button> do SYSARP.
                    </span>
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowRegister(false)} className="h-11 px-6 font-bold text-slate-500 border-slate-300 hover:bg-slate-50">Cancelar</Button>
                  <Button type="submit" disabled={loading} className="h-11 px-8 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-200/50">{loading ? "Enviando..." : "Solicitar Cadastro"}</Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}

      {/* --- MODAL DE ALTERAÇÃO DE SENHA --- */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 animate-fade-in">
           <Card className="w-full max-w-md p-8 shadow-2xl animate-fade-in bg-white rounded-2xl border-t-8 border-red-600">
              <div className="mb-6 text-center">
                 <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                    <KeyRound className="w-8 h-8" />
                 </div>
                 <h2 className="text-xl font-bold text-slate-800">Alteração Obrigatória</h2>
                 <p className="text-sm text-slate-500 mt-2 leading-relaxed">Por motivos de segurança, você deve redefinir sua senha no primeiro acesso.</p>
              </div>
              
              <form onSubmit={handleChangePassword} className="space-y-5">
                 <Input label="Nova Senha" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className="h-11 bg-slate-50" labelClassName="text-xs font-bold text-slate-500 uppercase" />
                 <Input label="Confirmar Nova Senha" type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} required className="h-11 bg-slate-50" labelClassName="text-xs font-bold text-slate-500 uppercase" />
                 
                 <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl mt-2">
                   <label className="flex items-start gap-3 cursor-pointer group">
                     <div className="relative flex items-center">
                        <input type="checkbox" className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-slate-300 shadow-sm checked:border-red-600 checked:bg-red-600 transition-all" checked={changePasswordTermsAccepted} onChange={e => setChangePasswordTermsAccepted(e.target.checked)} />
                        <CheckCircle className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" />
                     </div>
                     <span className="text-sm text-slate-600 leading-snug">
                       Li e aceito a <button type="button" onClick={() => setShowLgpdModal(true)} className="font-bold text-red-600 hover:text-red-800 hover:underline">Política de Privacidade</button>.
                     </span>
                   </label>
                 </div>
                 
                 <div className="pt-4">
                    <Button type="submit" disabled={loading} className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg shadow-red-200/50">{loading ? "Salvando..." : "Definir Senha e Acessar"}</Button>
                 </div>
              </form>
           </Card>
        </div>
      )}
    </div>
  );
}

// Helper icon component for Lotação section in modal
function Map({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/></svg>
    )
}
