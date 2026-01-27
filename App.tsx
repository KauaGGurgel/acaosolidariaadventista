import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";
import { 
  LayoutDashboard, Users, Package, ShoppingBasket, HeartHandshake, Menu, X, 
  Plus, Trash2, Edit2, Search, AlertTriangle, ArrowDown, MinusCircle, PlusCircle, 
  BellRing, Phone, MapPin, Calendar, History, Clock, CheckCircle, MessageSquare, 
  ShoppingBag, Calculator, RefreshCw, Save, ArrowRight, Check, Sparkles, BookOpen, 
  Utensils, Loader2, Copy, Database, AlertCircle, TrendingUp
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

// ==========================================
// 1. TIPOS E INTERFACES
// ==========================================
export interface DeliveryRecord {
  date: string;
  note?: string;
}

export interface Person {
  id: string;
  name: string;
  familySize: number;
  address: string;
  phone: string;
  lastBasketDate?: string;
  notes?: string;
  history?: DeliveryRecord[];
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: 'kg' | 'unidade' | 'litro' | 'pacote';
  category: 'alimento' | 'higiene' | 'vestuario';
  minThreshold: number;
}

export interface BasketItemConfig {
  itemId: string;
  quantityRequired: number;
}

export interface BasketConfig {
  name: string;
  items: BasketItemConfig[];
}

export interface DeliveryEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  description?: string;
}

export type ViewState = 'dashboard' | 'people' | 'inventory' | 'baskets' | 'ai-assistant';

// ==========================================
// 2. SERVIÇOS (SUPABASE & GEMINI)
// ==========================================

// --- SUPABASE SETUP ---
const getEnv = (key: string) => {
  try { return (process.env as any)[key]; } catch (e) { return ''; }
};

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY') || '';
const isValidConfig = SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 0;
const supabase = isValidConfig ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const isSupabaseConfigured = () => !!supabase;

// --- GEMINI SETUP ---
const apiKey = process.env.API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const generateSpiritualMessage = async (familyContext: string): Promise<string> => {
  if (!ai) return "Deus é o nosso refúgio e fortaleza. (Modo Offline - Configure a API Key)";
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Escreva uma mensagem curta, bíblica e adventista para uma família recebendo cesta básica. Contexto: ${familyContext}. Max 300 caracteres.`,
    });
    return response.text || "Deus proverá todas as suas necessidades.";
  } catch (error) {
    return "Que a paz de Deus esteja com sua família.";
  }
};

const suggestRecipe = async (inventory: InventoryItem[]): Promise<string> => {
  if (!ai) return "Receita indisponível (Configure a API Key)";
  try {
    const availableItems = inventory.map(i => `${i.quantity} ${i.unit} de ${i.name}`).join(', ');
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Com base nestes itens: ${availableItems}. Sugira uma receita simples e econômica para a cesta básica. Título e preparo resumido.`,
    });
    return response.text || "Receita não disponível.";
  } catch (error) {
    return "Consulte a equipe de cozinha.";
  }
};

// ==========================================
// 3. SUB-COMPONENTES
// ==========================================

const Sidebar: React.FC<{
  currentView: ViewState;
  setCurrentView: (view: ViewState) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}> = ({ currentView, setCurrentView, isOpen, setIsOpen }) => {
  const [imgError, setImgError] = useState(false);
  const menuItems = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'people', label: 'Beneficiários', icon: Users },
    { id: 'inventory', label: 'Estoque', icon: Package },
    { id: 'baskets', label: 'Cestas Básicas', icon: ShoppingBasket },
    { id: 'ai-assistant', label: 'Assistente ASA', icon: HeartHandshake },
  ];
  const logoUrl = "https://www.adventistas.org/pt/asa/wp-content/uploads/sites/6/2013/05/logo_asa_cor.png";

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setIsOpen(false)} />}
      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 text-white transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 flex flex-col h-full border-r border-slate-700 shadow-xl`}>
        <div className="p-6 flex items-center justify-between border-b border-slate-700 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded flex items-center justify-center p-1">
               {!imgError ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" onError={() => setImgError(true)} /> : <HeartHandshake className="text-yellow-500" />}
            </div>
            <div><h1 className="font-bold">ASA</h1><p className="text-xs text-slate-400">Gestão</p></div>
          </div>
          <button onClick={() => setIsOpen(false)} className="md:hidden"><X size={24} /></button>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button key={item.id} onClick={() => { setCurrentView(item.id as ViewState); setIsOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive ? 'bg-blue-900 text-yellow-400 font-medium' : 'text-slate-300 hover:bg-slate-800'}`}>
                <Icon size={20} /><span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
};

const Dashboard: React.FC<{
  people: Person[];
  inventory: InventoryItem[];
  events: DeliveryEvent[];
  setEvents: React.Dispatch<React.SetStateAction<DeliveryEvent[]>>;
}> = ({ people, inventory, events, setEvents }) => {
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', date: '', desc: '' });

  const totalFamilies = people.length;
  const totalBeneficiaries = people.reduce((acc, curr) => acc + curr.familySize, 0);
  const totalItems = inventory.reduce((acc, curr) => acc + curr.quantity, 0);
  const lowStock = inventory.filter(i => i.quantity <= i.minThreshold);
  const today = new Date().toISOString().split('T')[0];
  const upcoming = events.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));

  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.date) return;
    const evt: DeliveryEvent = { id: Date.now().toString(), title: newEvent.title, date: newEvent.date, description: newEvent.desc };
    setEvents(prev => [...prev, evt]);
    if (isSupabaseConfigured() && supabase) await supabase.from('eventos_entrega').insert(evt);
    setIsEventModalOpen(false); setNewEvent({ title: '', date: '', desc: '' });
  };

  const handleDeleteEvent = async (id: string) => {
    if(!window.confirm("Remover evento?")) return;
    setEvents(prev => prev.filter(e => e.id !== id));
    if (isSupabaseConfigured() && supabase) await supabase.from('eventos_entrega').delete().eq('id', id);
  };

  const StatCard = ({ title, value, sub, icon: Icon, color }: any) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <div className="flex justify-between items-start">
        <div><p className="text-slate-500 text-sm font-medium">{title}</p><h3 className="text-3xl font-bold text-slate-800 mt-2">{value}</h3><p className={`text-xs mt-1 ${color}`}>{sub}</p></div>
        <div className={`p-3 rounded-lg bg-opacity-10 ${color.replace('text-', 'bg-')}`}><Icon className={color} size={24} /></div>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-slate-800">Visão Geral</h2><button onClick={() => setIsEventModalOpen(true)} className="bg-white border px-4 py-2 rounded-lg flex gap-2 text-sm shadow-sm hover:bg-slate-50"><Plus size={16} /> Agendar</button></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Famílias" value={totalFamilies} sub={`${totalBeneficiaries} pessoas`} icon={Users} color="text-blue-600" />
        <StatCard title="Estoque" value={totalItems} sub="Unidades totais" icon={Package} color="text-green-600" />
        <StatCard title="Alertas" value={lowStock.length} sub="Itens acabando" icon={TrendingUp} color="text-red-500" />
        <StatCard title="Próximo" value={upcoming[0] ? new Date(upcoming[0].date).getDate() : "--"} sub={upcoming[0]?.title || "Nada agendado"} icon={Calendar} color="text-yellow-600" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-80">
           <h3 className="font-bold mb-4">Estoque Principal</h3>
           <ResponsiveContainer width="100%" height="100%"><BarChart data={inventory.slice(0,5)}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis/><Tooltip/><Bar dataKey="quantity" fill="#1e3a8a"/></BarChart></ResponsiveContainer>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 overflow-y-auto h-80">
           <h3 className="font-bold mb-4">Eventos e Alertas</h3>
           {lowStock.map(i => <div key={i.id} className="p-2 bg-red-50 border border-red-100 rounded mb-2 text-sm flex justify-between"><span className="text-red-800 font-bold">{i.name}</span><span className="text-red-600">Restam {i.quantity}</span></div>)}
           {upcoming.map(e => <div key={e.id} className="p-2 bg-yellow-50 border border-yellow-100 rounded mb-2 text-sm flex justify-between group"><div><div className="font-bold text-yellow-900">{e.title}</div><div className="text-xs text-yellow-700">{e.date}</div></div><button onClick={()=>handleDeleteEvent(e.id)} className="opacity-0 group-hover:opacity-100 text-red-500"><Trash2 size={16}/></button></div>)}
        </div>
      </div>
      {isEventModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-md space-y-4">
            <h3 className="font-bold text-lg">Novo Evento</h3>
            <input className="w-full border p-2 rounded" placeholder="Título" value={newEvent.title} onChange={e=>setNewEvent({...newEvent, title: e.target.value})} />
            <input className="w-full border p-2 rounded" type="date" value={newEvent.date} onChange={e=>setNewEvent({...newEvent, date: e.target.value})} />
            <textarea className="w-full border p-2 rounded" placeholder="Descrição" value={newEvent.desc} onChange={e=>setNewEvent({...newEvent, desc: e.target.value})} />
            <div className="flex justify-end gap-2"><button onClick={()=>setIsEventModalOpen(false)} className="px-4 py-2 text-slate-600">Cancelar</button><button onClick={handleAddEvent} className="px-4 py-2 bg-blue-900 text-white rounded">Salvar</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

const PeopleManager: React.FC<{ people: Person[]; setPeople: React.Dispatch<React.SetStateAction<Person[]>>; }> = ({ people, setPeople }) => {
  const [modal, setModal] = useState(false);
  const [formData, setFormData] = useState<Partial<Person>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [deliveryModal, setDeliveryModal] = useState<string | null>(null);
  const [deliveryData, setDeliveryData] = useState({ date: new Date().toISOString().split('T')[0], note: '' });

  const handleSave = async () => {
    if (!formData.name) return;
    const newPerson: Person = {
      id: formData.id || Date.now().toString(),
      name: formData.name,
      familySize: formData.familySize || 1,
      address: formData.address || '',
      phone: formData.phone || '',
      notes: formData.notes || '',
      history: formData.history || [],
      lastBasketDate: formData.lastBasketDate
    };
    if (formData.id) {
       setPeople(prev => prev.map(p => p.id === formData.id ? newPerson : p));
    } else {
       setPeople(prev => [...prev, newPerson]);
    }
    setModal(false); setFormData({});
  };

  const handleDelivery = (id: string) => {
    setPeople(prev => prev.map(p => {
       if (p.id === id) {
         return { ...p, lastBasketDate: deliveryData.date, history: [{ date: deliveryData.date, note: deliveryData.note }, ...(p.history || [])] };
       }
       return p;
    }));
    setDeliveryModal(null); setDeliveryData({ date: new Date().toISOString().split('T')[0], note: '' });
  };

  const handleDelete = async (id: string) => {
    if(!window.confirm("Excluir cadastro?")) return;
    setPeople(prev => prev.filter(p => p.id !== id));
    if (isSupabaseConfigured() && supabase) await supabase.from('beneficiarios').delete().eq('id', id);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Beneficiários</h2>
        <button onClick={() => { setFormData({}); setModal(true); }} className="bg-blue-900 text-white px-4 py-2 rounded-lg flex items-center gap-2"><Plus size={20} /> Cadastrar</button>
      </div>
      <div className="mb-4 bg-white p-3 rounded-lg border flex items-center gap-3"><Search className="text-slate-400" /><input placeholder="Buscar..." className="outline-none w-full" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} /></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {people.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
          <div key={p.id} className="bg-white p-5 rounded-xl border shadow-sm hover:shadow-md transition-shadow relative group">
            <div className="flex justify-between items-start mb-3">
               <div className="flex gap-3 items-center"><div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700">{p.name[0]}</div><div><h3 className="font-bold">{p.name}</h3><p className="text-xs text-slate-500">{p.familySize} pessoas</p></div></div>
               <button onClick={()=>handleDelete(p.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={18}/></button>
            </div>
            <div className="text-sm text-slate-600 space-y-1 mb-4">
               <div className="flex gap-2"><Phone size={14}/> {p.phone}</div>
               <div className="flex gap-2"><MapPin size={14}/> <span className="truncate">{p.address}</span></div>
               <div className="flex gap-2"><Calendar size={14}/> Última: {p.lastBasketDate || 'Nunca'}</div>
            </div>
            <div className="flex gap-2">
               <button onClick={()=>{ setFormData(p); setModal(true); }} className="flex-1 py-2 bg-slate-50 border rounded text-sm flex items-center justify-center gap-2 hover:bg-slate-100"><Edit2 size={14}/> Editar</button>
               <button onClick={()=>setDeliveryModal(p.id)} className="flex-1 py-2 bg-green-50 text-green-700 border border-green-200 rounded text-sm flex items-center justify-center gap-2 hover:bg-green-100"><CheckCircle size={14}/> Entregar</button>
            </div>
          </div>
        ))}
      </div>
      {(modal || deliveryModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-md space-y-4">
            {modal ? (
              <>
                 <h3 className="font-bold text-lg">{formData.id ? 'Editar' : 'Novo'} Cadastro</h3>
                 <input className="w-full border p-2 rounded" placeholder="Nome" value={formData.name || ''} onChange={e=>setFormData({...formData, name: e.target.value})} />
                 <div className="flex gap-2">
                    <input className="w-full border p-2 rounded" type="number" placeholder="Tamanho Família" value={formData.familySize || ''} onChange={e=>setFormData({...formData, familySize: Number(e.target.value)})} />
                    <input className="w-full border p-2 rounded" placeholder="Telefone" value={formData.phone || ''} onChange={e=>setFormData({...formData, phone: e.target.value})} />
                 </div>
                 <input className="w-full border p-2 rounded" placeholder="Endereço" value={formData.address || ''} onChange={e=>setFormData({...formData, address: e.target.value})} />
                 <textarea className="w-full border p-2 rounded" placeholder="Observações" value={formData.notes || ''} onChange={e=>setFormData({...formData, notes: e.target.value})} />
                 <div className="flex justify-end gap-2"><button onClick={()=>setModal(false)} className="px-4 py-2 text-slate-600">Cancelar</button><button onClick={handleSave} className="px-4 py-2 bg-blue-900 text-white rounded">Salvar</button></div>
              </>
            ) : (
              <>
                 <h3 className="font-bold text-lg">Registrar Entrega</h3>
                 <input className="w-full border p-2 rounded" type="date" value={deliveryData.date} onChange={e=>setDeliveryData({...deliveryData, date: e.target.value})} />
                 <textarea className="w-full border p-2 rounded" placeholder="Obs da entrega..." value={deliveryData.note} onChange={e=>setDeliveryData({...deliveryData, note: e.target.value})} />
                 <div className="flex justify-end gap-2"><button onClick={()=>setDeliveryModal(null)} className="px-4 py-2 text-slate-600">Cancelar</button><button onClick={()=> deliveryModal && handleDelivery(deliveryModal)} className="px-4 py-2 bg-green-600 text-white rounded">Confirmar</button></div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const InventoryManager: React.FC<{ inventory: InventoryItem[]; setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>; }> = ({ inventory, setInventory }) => {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Partial<InventoryItem>>({});
  const [search, setSearch] = useState('');

  const handleSave = async () => {
    if (!editing.name) return;
    const item: InventoryItem = {
       id: editing.id || Date.now().toString(),
       name: editing.name,
       quantity: editing.quantity || 0,
       unit: editing.unit || 'kg',
       category: editing.category || 'alimento',
       minThreshold: editing.minThreshold || 10
    };
    if (editing.id) setInventory(prev => prev.map(i => i.id === editing.id ? item : i));
    else setInventory(prev => [...prev, item]);
    setModal(false); setEditing({});
  };

  const adjustQty = (id: string, delta: number) => {
    setInventory(prev => prev.map(i => i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i));
  };

  const handleDelete = async (id: string) => {
    if(!window.confirm("Remover item?")) return;
    setInventory(prev => prev.filter(i => i.id !== id));
    if (isSupabaseConfigured() && supabase) await supabase.from('estoque').delete().eq('id', id);
  };

  return (
    <div className="p-6">
       <div className="flex justify-between mb-6"><h2 className="text-2xl font-bold text-slate-800">Despensa</h2><button onClick={()=>{setEditing({}); setModal(true)}} className="bg-blue-900 text-white px-4 py-2 rounded-lg flex items-center gap-2"><Plus size={20}/> Adicionar</button></div>
       <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="p-4 border-b flex items-center gap-3"><Search className="text-slate-400"/><input placeholder="Buscar item..." className="w-full outline-none" value={search} onChange={e=>setSearch(e.target.value)}/></div>
          <table className="w-full text-left">
             <thead className="bg-slate-100 text-slate-600 uppercase text-xs"><tr><th className="p-4">Item</th><th className="p-4">Qtd</th><th className="p-4">Mínimo</th><th className="p-4 text-right">Ações</th></tr></thead>
             <tbody className="divide-y">
                {inventory.filter(i=>i.name.toLowerCase().includes(search.toLowerCase())).map(i => (
                   <tr key={i.id} className={i.quantity <= i.minThreshold ? 'bg-red-50' : ''}>
                      <td className="p-4 font-medium">{i.name} <span className="text-xs text-slate-500 block">{i.category}</span></td>
                      <td className="p-4"><div className="flex items-center gap-3"><button onClick={()=>adjustQty(i.id, -1)}><MinusCircle size={18} className="text-slate-400 hover:text-red-500"/></button><span className="font-bold w-12 text-center">{i.quantity}</span><button onClick={()=>adjustQty(i.id, 1)}><PlusCircle size={18} className="text-slate-400 hover:text-green-500"/></button><span className="text-xs text-slate-500">{i.unit}</span></div></td>
                      <td className="p-4 text-sm text-slate-500 flex items-center gap-2">{i.quantity <= i.minThreshold && <AlertTriangle size={14} className="text-red-500"/>} {i.minThreshold}</td>
                      <td className="p-4 text-right"><button onClick={()=>{setEditing(i); setModal(true)}} className="p-2 text-blue-600"><Edit2 size={18}/></button><button onClick={()=>handleDelete(i.id)} className="p-2 text-red-600"><Trash2 size={18}/></button></td>
                   </tr>
                ))}
             </tbody>
          </table>
       </div>
       {modal && (
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl w-full max-w-sm space-y-4">
               <h3 className="font-bold text-lg">{editing.id ? 'Editar' : 'Novo'} Item</h3>
               <input className="w-full border p-2 rounded" placeholder="Nome" value={editing.name||''} onChange={e=>setEditing({...editing, name: e.target.value})}/>
               <div className="flex gap-2">
                  <input className="w-full border p-2 rounded" type="number" placeholder="Qtd" value={editing.quantity||''} onChange={e=>setEditing({...editing, quantity: Number(e.target.value)})}/>
                  <select className="w-full border p-2 rounded" value={editing.unit||'kg'} onChange={e=>setEditing({...editing, unit: e.target.value as any})}><option value="kg">kg</option><option value="unidade">un</option><option value="pacote">pct</option><option value="litro">lt</option></select>
               </div>
               <div className="flex gap-2">
                  <select className="w-full border p-2 rounded" value={editing.category||'alimento'} onChange={e=>setEditing({...editing, category: e.target.value as any})}><option value="alimento">Alimento</option><option value="higiene">Higiene</option></select>
                  <input className="w-full border p-2 rounded" type="number" placeholder="Mínimo" value={editing.minThreshold||''} onChange={e=>setEditing({...editing, minThreshold: Number(e.target.value)})}/>
               </div>
               <div className="flex justify-end gap-2"><button onClick={()=>setModal(false)} className="px-4 py-2 text-slate-600">Cancelar</button><button onClick={handleSave} className="px-4 py-2 bg-blue-900 text-white rounded">Salvar</button></div>
            </div>
         </div>
       )}
    </div>
  );
};

const BasketCalculator: React.FC<{ 
  inventory: InventoryItem[]; setInventory: (i: InventoryItem[]) => void;
  basketConfig: BasketConfig; setBasketConfig: (c: BasketConfig) => void;
  assembledBaskets: number; setAssembledBaskets: (n: number) => void;
}> = ({ inventory, setInventory, basketConfig, setBasketConfig, assembledBaskets, setAssembledBaskets }) => {
  const [selectedItem, setSelectedItem] = useState('');
  
  const stats = useMemo(() => {
    const details = basketConfig.items.map(ci => {
      const inv = inventory.find(i => i.id === ci.itemId);
      const stock = inv?.quantity || 0;
      const possible = ci.quantityRequired > 0 ? Math.floor(stock / ci.quantityRequired) : 9999;
      return { ...ci, name: inv?.name || '?', stock, possible };
    });
    const max = details.length ? Math.min(...details.map(d => d.possible)) : 0;
    return { max, details };
  }, [basketConfig, inventory]);

  const assemble = () => {
    if (stats.max < 1) return;
    const newInv = inventory.map(invItem => {
      const ci = basketConfig.items.find(x => x.itemId === invItem.id);
      return ci ? { ...invItem, quantity: invItem.quantity - ci.quantityRequired } : invItem;
    });
    setInventory(newInv);
    setAssembledBaskets(assembledBaskets + 1);
  };

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
       <div>
          <h2 className="text-2xl font-bold mb-4">Configuração da Cesta</h2>
          <div className="bg-white rounded-xl border p-4 space-y-4">
             <input className="font-bold text-lg w-full border-b outline-none" value={basketConfig.name} onChange={e=>setBasketConfig({...basketConfig, name: e.target.value})} />
             {stats.details.map(d => (
               <div key={d.itemId} className="flex items-center justify-between bg-slate-50 p-2 rounded">
                  <div><div className="font-bold">{d.name}</div><div className="text-xs text-slate-500">Estoque: {d.stock}</div></div>
                  <div className="flex items-center gap-2">
                     <input type="number" step="0.5" className="w-16 p-1 border rounded text-right" value={d.quantityRequired} onChange={e=>{
                        const newItems = basketConfig.items.map(x => x.itemId === d.itemId ? {...x, quantityRequired: Number(e.target.value)} : x);
                        setBasketConfig({...basketConfig, items: newItems});
                     }} />
                     <button onClick={()=>setBasketConfig({...basketConfig, items: basketConfig.items.filter(x=>x.itemId!==d.itemId)})} className="text-red-500"><Trash2 size={16}/></button>
                  </div>
               </div>
             ))}
             <div className="flex gap-2 mt-4 pt-4 border-t">
                <select className="flex-1 border rounded p-2" value={selectedItem} onChange={e=>setSelectedItem(e.target.value)}>
                   <option value="">Adicionar item...</option>
                   {inventory.filter(i=>!basketConfig.items.find(x=>x.itemId===i.id)).map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <button disabled={!selectedItem} onClick={()=>{setBasketConfig({...basketConfig, items: [...basketConfig.items, {itemId: selectedItem, quantityRequired: 1}]}); setSelectedItem('')}} className="bg-blue-900 text-white p-2 rounded"><Plus/></button>
             </div>
          </div>
       </div>
       <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-white p-4 rounded-xl border shadow-sm">
                <div className="text-xs text-slate-500 uppercase">Cestas Prontas</div>
                <div className="text-4xl font-bold text-slate-800 flex justify-between items-end">{assembledBaskets} <Package className="text-blue-500"/></div>
             </div>
             <div className="bg-white p-4 rounded-xl border shadow-sm">
                <div className="text-xs text-slate-500 uppercase">Pode Montar</div>
                <div className="text-4xl font-bold text-green-600 flex justify-between items-end">{stats.max} <Calculator className="text-green-500"/></div>
             </div>
          </div>
          <button onClick={assemble} disabled={stats.max < 1} className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-3 text-lg transition-transform active:scale-95">
             Confirmar Montagem de 1 Cesta <ArrowRight/>
          </button>
       </div>
    </div>
  );
};

const AiAssistant: React.FC<{ inventory: InventoryItem[]; people: Person[] }> = ({ inventory, people }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [personId, setPersonId] = useState('');

  const run = async (action: 'msg' | 'recipe') => {
    setLoading(true); setResult('');
    if (action === 'msg') {
       const p = people.find(x => x.id === personId);
       if(p) setResult(await generateSpiritualMessage(`Família ${p.name}, ${p.familySize} pessoas. Obs: ${p.notes}`));
    } else {
       setResult(await suggestRecipe(inventory));
    }
    setLoading(false);
  };

  return (
    <div className="p-6">
       <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Sparkles className="text-yellow-500"/> Assistente IA</h2>
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
             <div className="bg-white p-4 rounded-xl border space-y-4">
                <h3 className="font-bold flex gap-2"><BookOpen size={18}/> Mensagem</h3>
                <select className="w-full border p-2 rounded" value={personId} onChange={e=>setPersonId(e.target.value)}><option value="">Selecione a família...</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
                <button disabled={!personId || loading} onClick={()=>run('msg')} className="w-full bg-blue-900 text-white py-2 rounded">Gerar Mensagem</button>
             </div>
             <div className="bg-white p-4 rounded-xl border space-y-4">
                <h3 className="font-bold flex gap-2"><Utensils size={18}/> Receita</h3>
                <button disabled={loading} onClick={()=>run('recipe')} className="w-full bg-green-700 text-white py-2 rounded">Sugerir Receita</button>
             </div>
          </div>
          <div className="md:col-span-2 bg-white p-6 rounded-xl border min-h-[300px] relative">
             {loading ? <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin text-blue-900" size={40}/></div> : 
             result ? <div className="prose whitespace-pre-wrap">{result}</div> : <div className="text-center text-slate-400 mt-20">O resultado aparecerá aqui...</div>}
          </div>
       </div>
    </div>
  );
};

// ==========================================
// 4. APP PRINCIPAL
// ==========================================
export default function App() {
  const [view, setView] = useState<ViewState>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [events, setEvents] = useState<DeliveryEvent[]>([]);
  const [baskets, setBaskets] = useState(0);
  const [basketConfig, setBasketConfig] = useState<BasketConfig>({ name: 'Padrão', items: [] });
  const [loading, setLoading] = useState(true);

  // Inicialização
  useEffect(() => {
    const init = async () => {
       if (isSupabaseConfigured() && supabase) {
          const { data: p } = await supabase.from('beneficiarios').select('*');
          const { data: i } = await supabase.from('estoque').select('*');
          const { data: e } = await supabase.from('eventos_entrega').select('*');
          if(p) setPeople(p as any); if(i) setInventory(i as any); if(e) setEvents(e as any);
       } else {
          // Fallback LocalStorage
          const ls = (k:string) => { try { return JSON.parse(localStorage.getItem(k)||'[]') } catch(e){ return [] } };
          setPeople(ls('people')); setInventory(ls('inventory')); setEvents(ls('events'));
       }
       setLoading(false);
    };
    init();
  }, []);

  // Persistência LocalStorage (Backup)
  useEffect(() => {
    if(!loading) {
       localStorage.setItem('people', JSON.stringify(people));
       localStorage.setItem('inventory', JSON.stringify(inventory));
       localStorage.setItem('events', JSON.stringify(events));
    }
  }, [people, inventory, events, loading]);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" size={48}/></div>;

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden">
      <Sidebar currentView={view} setCurrentView={setView} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
         <header className="md:hidden bg-blue-900 text-white p-4 flex justify-between items-center shadow">
            <div className="font-bold">ASA Gestão</div>
            <button onClick={()=>setSidebarOpen(true)}><Menu/></button>
         </header>
         <main className="flex-1 overflow-y-auto">
            {view === 'dashboard' && <Dashboard people={people} inventory={inventory} events={events} setEvents={setEvents} />}
            {view === 'people' && <PeopleManager people={people} setPeople={setPeople} />}
            {view === 'inventory' && <InventoryManager inventory={inventory} setInventory={setInventory} />}
            {view === 'baskets' && <BasketCalculator inventory={inventory} setInventory={setInventory} basketConfig={basketConfig} setBasketConfig={setBasketConfig} assembledBaskets={baskets} setAssembledBaskets={setBaskets} />}
            {view === 'ai-assistant' && <AiAssistant inventory={inventory} people={people} />}
         </main>
      </div>
    </div>
  );
}
