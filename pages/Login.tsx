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
    <div className="min-h-screen bg-gradient-to-br from-sysarp-dark via-sysarp-primary to-sysarp-dark flex flex-col items-center justify-center p-4 py-8 overflow-y-auto">
      
      {/* EMAIL FIX MODAL */}
      {emailFixSql && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in">
           <Card className="w-full max-w-3xl flex flex-col bg-white border-4 border-amber-500 shadow-2xl">
              <div className="p-4 bg-amber-500 text-white flex justify-between items-center">
                 <h3 className="font-bold text-lg flex items-center gap-2">
                   <LogIn className="w-6 h-6" />
                   Ação Administrativa Necessária
                 </h3>
                 <button onClick={() => setEmailFixSql(null)} className="hover:bg-amber-600 p-1 rounded"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                 <p className="text-slate-700 font-medium">
                    Ajuste técnico de banco de dados requerido para validação de e-mails institucionais.
                 </p>
                 <div className="relative">
                    <pre className="bg-slate-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto font-mono border border-slate-700 max-h-64">
                       {emailFixSql}
                    </pre>
                    <button onClick={() => copySqlToClipboard(emailFixSql)} className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white p-2 rounded transition-colors"><Copy className="w-4 h-4" /></button>
                 </div>
              </div>
              <div className="p-4 bg-slate-50 border-t flex justify-end gap-3">
                 <Button variant="outline" onClick={() => setEmailFixSql(null)}>Fechar</Button>
                 <Button onClick={() => copySqlToClipboard(emailFixSql)} className="bg-amber-600 text-white hover:bg-amber-700"><Copy className="w-4 h-4 mr-2" /> Copiar SQL</Button>
              </div>
           </Card>
        </div>
      )}

      {/* LGPD Modal */}
      {showLgpdModal && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
           <Card className="max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col bg-white">
              <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                 <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                   <FileText className="w-5 h-5 text-red-600" />
                   Política de Privacidade e Termos de Uso
                 </h3>
                 <button onClick={() => setShowLgpdModal(false)} className="p-1 hover:bg-slate-200 rounded"><X className="w-5 h-5 text-slate-500" /></button>
              </div>
              <div className="p-6 overflow-y-auto text-sm text-slate-700 whitespace-pre-line leading-relaxed bg-white">
                 {LGPD_TERMS}
              </div>
              <div className="p-4 border-t bg-slate-50 flex justify-end">
                 <Button onClick={() => setShowLgpdModal(false)}>Fechar</Button>
              </div>
           </Card>
        </div>
      )}

      {/* Main Content */}
      <div className="w-full max-w-md">
        <div className="text-center mb-6 md:mb-8">
           <div className="w-24 h-24 md:w-32 md:h-32 bg-white/10 backdrop-blur-sm rounded-xl md:rounded-2xl flex items-center justify-center mx-auto mb-3 md:mb-4 shadow-lg p-2 md:p-3 border-2 border-white/20">
              {logoError ? (
                  <Shield className="w-12 h-12 md:w-16 md:h-16 text-white" />
              ) : (
                  <img 
                    src={SYSARP_LOGO} 
                    className="w-full h-full object-contain" 
                    alt="SYSARP Logo"
                    onError={() => setLogoError(true)}
                  />
              )}
           </div>
           <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-widest uppercase" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>SYSARP</h1>
           <p className="text-red-200 text-xs font-medium uppercase tracking-wider">Sistema de Aeronaves Remotamente Pilotadas</p>
        </div>

        <Card className="p-6 md:p-8 shadow-2xl bg-white/95 backdrop-blur-lg border border-white/20">
          <form onSubmit={handleLogin} className="space-y-5 md:space-y-6">
            <div className="text-center border-b border-slate-200 pb-3 md:pb-4">
               <h2 className="text-lg md:text-xl font-bold text-slate-800">Acesso Restrito</h2>
               <p className="text-xs text-slate-500 uppercase font-medium">Corpo de Bombeiros Militar do Paraná</p>
            </div>

            {loginError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-3 animate-fade-in">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <span className="text-sm font-bold text-red-700">{loginError}</span>
              </div>
            )}

            <div className="space-y-3 md:space-y-4">
              <div className="relative">
                <Input 
                  label="Usuário" 
                  value={username} 
                  onChange={handleUsernameChange} 
                  placeholder="nome.sobrenome"
                  type="text"
                  required
                  autoComplete="username"
                  className="lowercase pr-12"
                />
                <div className="absolute right-3 bottom-2.5 text-slate-300 pointer-events-none">
                  <User className="w-5 h-5" />
                </div>
              </div>
              <Input 
                label="Senha" 
                type="password"
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <div className="pt-2 space-y-3">
               <Button type="submit" disabled={loading} className="w-full h-11 md:h-12 font-bold text-base md:text-lg shadow-lg shadow-red-500/30">
                  <LogIn className="w-5 h-5 mr-2" />
                  {loading ? 'Entrando...' : 'Acessar Sistema'}
               </Button>
               <Button type="button" variant="outline" className="w-full h-11 md:h-12" onClick={() => setShowRegister(true)}>
                  <UserPlus className="w-4 h-4 mr-2"/> Solicitar Cadastro de Piloto
               </Button>
            </div>
          </form>
        </Card>
        
        <div className="text-center mt-6 md:mt-8 space-y-1">
           <p className="text-red-200/50 text-xs">© {new Date().getFullYear()} SYSARP - CBMPR - V.1.0</p>
           <p className="text-red-200/30 text-[10px] uppercase tracking-wider font-medium">Desenvolvido por Cb Paulo</p>
        </div>
      </div>

      {/* --- MODAL DE CADASTRO --- */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl p-4 md:p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 md:mb-6 border-b pb-4">
              <h2 className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2">
                <UserPlus className="w-6 h-6 text-blue-600" />
                Solicitar Cadastro de Piloto
              </h2>
              <button onClick={() => setShowRegister(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRegister} className="space-y-3 md:space-y-4">
              
              <div className="w-full">
                  <Input 
                    label="Nome Completo" 
                    value={regForm.full_name} 
                    onChange={e => setRegForm({...regForm, full_name: e.target.value})}
                    placeholder="Ex: João Pereira"
                    required
                  />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Identificador de Usuário</label>
                <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-red-500">
                  <Input 
                    className="flex-1 text-right !border-0 !ring-0 rounded-r-none lowercase" 
                    placeholder="nome.sobrenome"
                    value={regEmailPrefix}
                    onChange={e => setRegEmailPrefix(e.target.value.replace(/[^a-z0-9._-]/gi, '').toLowerCase())}
                    required
                  />
                  <span className="bg-slate-50 px-3 py-2 text-slate-500 border-l text-xs md:text-sm">@cbm.pr.gov.br</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <Input label="Telefone" value={regForm.phone} onChange={e => setRegForm({...regForm, phone: e.target.value})} placeholder="(41) 99999-9999" required />
                <Input label="Código SARPAS" value={regForm.sarpas_code} onChange={e => setRegForm({...regForm, sarpas_code: e.target.value})} placeholder="BR-XXXXXX" required />
              </div>

              <div className="p-3 md:p-4 bg-slate-50 rounded-lg border">
                 <h3 className="text-sm font-bold mb-3">Lotação</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <Select label="CRBM" value={regForm.crbm} onChange={e => setRegForm({...regForm, crbm: e.target.value, unit: ''})} required>
                       <option value="">Selecione o CRBM</option>
                       {Object.keys(ORGANIZATION_CHART).map(crbm => <option key={crbm} value={crbm}>{crbm}</option>)}
                    </Select>
                    <Select label="Unidade (BBM/CIBM/BOA)" value={regForm.unit} disabled={!regForm.crbm} onChange={e => setRegForm({...regForm, unit: e.target.value})}>
                       <option value="">Selecione a Unidade</option>
                       {regForm.crbm && ORGANIZATION_CHART[regForm.crbm as keyof typeof ORGANIZATION_CHART]?.map((unit: string) => <option key={unit} value={unit}>{unit}</option>)}
                    </Select>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <Input label="Senha" type="password" value={regForm.password} onChange={e => setRegForm({...regForm, password: e.target.value})} required />
                <Input label="Confirmar Senha" type="password" value={regForm.confirmPassword} onChange={e => setRegForm({...regForm, confirmPassword: e.target.value})} required />
              </div>

              <div className="bg-blue-50 border border-blue-200 p-3 md:p-4 rounded-lg">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" className="w-5 h-5 accent-blue-600 mt-0.5" checked={regForm.terms_accepted} onChange={e => setRegForm({...regForm, terms_accepted: e.target.checked})} />
                  <span className="text-sm text-blue-800">
                    Li e concordo com a <button type="button" onClick={() => setShowLgpdModal(true)} className="font-bold underline hover:text-blue-600">Política de Privacidade e Termos de Uso</button> do SYSARP.
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowRegister(false)}>Cancelar</Button>
                <Button type="submit" disabled={loading}>{loading ? "Enviando..." : "Solicitar Cadastro"}</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* --- MODAL DE ALTERAÇÃO DE SENHA --- */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center p-4">
           <Card className="w-full max-w-md p-6 shadow-2xl animate-fade-in">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><KeyRound className="w-6 h-6 text-red-600"/> Alteração de Senha Obrigatória</h2>
              <p className="text-sm text-slate-600 mb-4">Por segurança, você deve definir uma nova senha pessoal para seu primeiro acesso.</p>
              <form onSubmit={handleChangePassword} className="space-y-4">
                 <Input label="Nova Senha" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                 <Input label="Confirmar Nova Senha" type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} required />
                 
                 <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mt-2">
                   <label className="flex items-start gap-3 cursor-pointer">
                     <input type="checkbox" className="w-5 h-5 accent-blue-600 mt-0.5" checked={changePasswordTermsAccepted} onChange={e => setChangePasswordTermsAccepted(e.target.checked)} />
                     <span className="text-sm text-blue-800">
                       Eu li e aceito a <button type="button" onClick={() => setShowLgpdModal(true)} className="font-bold underline hover:text-blue-600">Política de Privacidade e Termos de Uso</button>.
                     </span>
                   </label>
                 </div>
                 
                 <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={loading}>{loading ? "Salvando..." : "Definir Senha e Acessar"}</Button>
                 </div>
              </form>
           </Card>
        </div>
      )}
    </div>
  );
}
