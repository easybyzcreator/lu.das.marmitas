import { PrintReceiptModal, PrintReceiptData } from "./PrintReceiptModal";
import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc, 
  query, orderBy 
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { Product, Order, Settings, Category, Side, ImageGallery, VariableCost, DeliveryNeighborhood } from '../types';
import { 
  Settings as SettingsIcon, Package, History, LogOut, Plus, Trash2, Edit2, 
  Save, X, Copy, CheckCircle2, Loader2, Layers, Image as ImageIcon,
  ArrowUp, ArrowDown, ArrowUpDown, ChevronsUp, ChevronsDown, Sparkles, ListOrdered, MessageCircle, MessageSquare, Calendar, Printer, Cake, Eye, EyeOff, ArrowLeft,
  DollarSign, Coins, ChevronDown, ChevronUp, Users, Download, Truck, Search, Info, Table,
  ChevronLeft, ChevronRight, Clock, LayoutGrid, CalendarDays, Check, ShoppingBag, User, Mail, MapPin, FileText,
  ExternalLink, Utensils, RefreshCw, HelpCircle, Leaf, Code, ToggleLeft, ToggleRight,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, cleanFirestoreData, getCanonicalDishKey } from '../lib/utils';
import { toast } from 'sonner';
import Footer from './Footer';
import BRDatePicker from './BRDatePicker';
import AdminSupplies from './AdminSupplies';
import { initialProducts, initialCategories } from '../data/defaultCatalog';
import { ensureDefaultCatalogSeeded, markCategoryAsDeleted, markProductAsDeleted } from '../lib/catalogInit';

const getContrastText = (hexColor?: string): string => {
  if (!hexColor) return '#ffffff';
  let hex = hexColor.trim();
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  if (hex.length !== 6) return '#ffffff';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const hsp = Math.sqrt(
    0.299 * (r * r) +
    0.587 * (g * g) +
    0.114 * (b * b)
  );
  return hsp > 155 ? '#000000' : '#ffffff';
};

const getColorWithLegibility = (hexColor?: string, defaultColor: string = '#865d39'): string => {
  if (!hexColor) return defaultColor;
  let hex = hexColor.trim();
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  if (hex.length !== 6) return defaultColor;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (luminance > 0.6) {
    return defaultColor;
  }
  return `#${hex}`;
};

const formatBRPhone = (value: string): string => {
  let val = value.replace(/\D/g, '');
  
  // Truncate at 11 digits to strictly respect the 11-digit Brazilian mask: (99) 99999-9999
  if (val.length > 11) {
    val = val.slice(0, 11);
  }
  
  if (val.length === 0) return '';
  if (val.length <= 2) {
    return `(${val}`;
  }
  if (val.length <= 6) {
    return `(${val.slice(0, 2)}) ${val.slice(2)}`;
  }
  if (val.length <= 10) {
    return `(${val.slice(0, 2)}) ${val.slice(2, 6)}-${val.slice(6)}`;
  }
  return `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7)}`;
};

const getCleanWhatsAppPhone = (phone: string): string => {
  let clean = phone.replace(/\D/g, '');
  
  // If the numeric result does not start with '55', add '55' in front
  if (clean.length > 0 && !clean.startsWith('55')) {
    clean = '55' + clean;
  }
  
  return clean;
};

const handleDateMask = (value: string): string => {
  const cleanValue = value.replace(/\D/g, '').substring(0, 8);
  let formatted = '';
  if (cleanValue.length > 0) {
    formatted += cleanValue.substring(0, 2);
  }
  if (cleanValue.length > 2) {
    formatted += '/' + cleanValue.substring(2, 4);
  }
  if (cleanValue.length > 4) {
    formatted += '/' + cleanValue.substring(4, 8);
  }
  return formatted;
};

const formatOrderFullDate = (val: any): string => {
  if (!val) return 'Data não informada';
  if (typeof val.toDate === 'function') {
    return val.toDate().toLocaleString('pt-BR');
  }
  if (val.seconds) {
    return new Date(val.seconds * 1000).toLocaleString('pt-BR');
  }
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? 'Data não informada' : val.toLocaleString('pt-BR');
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? String(val) : d.toLocaleString('pt-BR');
  }
  return 'Data não informada';
};

const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAYS_SHORT_PT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

const getOrderScheduledInfo = (order: Order): { date: Date | null, timeStr: string, isDelivery: boolean, dateDisplay: string } => {
  let date: Date | null = null;
  let timeStr = order.scheduledTime || '';
  let isDelivery = order.deliveryOption !== 'pickup';
  let dateDisplay = '';

  if (order.scheduledDate) {
    const raw = order.scheduledDate.trim();
    if (raw.includes('/')) {
      const parts = raw.split('/');
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);
        if (d && m && y) {
          date = new Date(y, m - 1, d);
          dateDisplay = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
        }
      }
    } else if (raw.includes('-')) {
      const parts = raw.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        if (d && m && y) {
          date = new Date(y, m - 1, d);
          dateDisplay = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
        }
      }
    }
  }

  if (!date && order.pickupDate) {
    const str = order.pickupDate;
    if (str.toLowerCase().includes('pickup') || str.toLowerCase().includes('retirada')) {
      isDelivery = false;
    }
    const timeMatch = str.match(/@\s*([0-9]{1,2}:[0-9]{2}(?:\s*[AP]M)?)/i) || str.match(/\b([0-9]{1,2}:[0-9]{2})\b/i);
    if (timeMatch && !timeStr) {
      timeStr = timeMatch[1];
    }

    const ymdMatch = str.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (ymdMatch) {
      const y = parseInt(ymdMatch[1], 10);
      const m = parseInt(ymdMatch[2], 10);
      const d = parseInt(ymdMatch[3], 10);
      date = new Date(y, m - 1, d);
      dateDisplay = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    } else {
      const slashMatch = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (slashMatch) {
        let part1 = parseInt(slashMatch[1], 10);
        let part2 = parseInt(slashMatch[2], 10);
        let y = parseInt(slashMatch[3], 10);
        let d = part1;
        let m = part2;
        if (part1 > 12) {
          d = part1;
          m = part2;
        } else if (part2 > 12) {
          d = part2;
          m = part1;
        }
        date = new Date(y, m - 1, d);
        dateDisplay = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
      }
    }
  }

  if (!date && order.createdAt) {
    let dObj: Date | null = null;
    if (typeof (order.createdAt as any).toDate === 'function') {
      dObj = (order.createdAt as any).toDate();
    } else if ((order.createdAt as any).seconds) {
      dObj = new Date((order.createdAt as any).seconds * 1000);
    } else if (order.createdAt instanceof Date) {
      dObj = order.createdAt;
    } else if (typeof order.createdAt === 'string' || typeof order.createdAt === 'number') {
      const parsed = new Date(order.createdAt);
      if (!isNaN(parsed.getTime())) dObj = parsed;
    }

    if (dObj && !isNaN(dObj.getTime())) {
      date = dObj;
      const d = dObj.getDate();
      const m = dObj.getMonth() + 1;
      const y = dObj.getFullYear();
      dateDisplay = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
      if (!timeStr) {
        timeStr = dObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }
    }
  }

  if (order.wantsReadyDelivery) {
    dateDisplay = dateDisplay ? `${dateDisplay} [⚡ Pronta Entrega (Sob Consulta)]` : '⚡ Pronta Entrega (Sob Consulta)';
  }

  return { date, timeStr, isDelivery, dateDisplay };
};

export default function Admin({ settings, setSettings, setIsAdmin }: { 
  settings: Settings, 
  setSettings: React.Dispatch<React.SetStateAction<Settings>>,
  setIsAdmin: React.Dispatch<React.SetStateAction<boolean>>
}) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [galleryIdToDelete, setGalleryIdToDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'settings' | 'menu' | 'orderMenu' | 'orders' | 'categories' | 'sides' | 'customers' | 'cakeOptions' | 'galleries' | 'finance' | 'supplies'>('orders');
  const [selectedOrderCategoryId, setSelectedOrderCategoryId] = useState<string>('');
  const [galleries, setGalleries] = useState<ImageGallery[]>([]);
  const [sides, setSides] = useState<Side[]>([]);
  const [newSide, setNewSide] = useState<Partial<Side>>({ name: '', price: 0, type: 'side' });
  const [isEditingSide, setIsEditingSide] = useState<Side | null>(null);
  const [sidePriceInput, setSidePriceInput] = useState('');
  
  // Finance States
  const [variableCosts, setVariableCosts] = useState<VariableCost[]>([]);
  const [newVarCost, setNewVarCost] = useState<Partial<VariableCost>>({ description: '', amount: 0, date: new Date().toISOString().split('T')[0] });
  const [varCostAmountInput, setVarCostAmountInput] = useState('');
  const [isEditingVarCost, setIsEditingVarCost] = useState<VariableCost | null>(null);
  const [isProportionalFixed, setIsProportionalFixed] = useState<boolean>(true);

  // EGN Cash Flow Simulation states
  const [financeSubTab, setFinanceSubTab] = useState<'real' | 'simulation'>('real');
  const [selectedInstruction, setSelectedInstruction] = useState<string | null>('Clique em qualquer linha ou ícone de informação (?) para ver a instrução correspondente aqui.');
  const [egnSheet, setEgnSheet] = useState(() => {
    try {
      const saved = localStorage.getItem('egn_fluxo_caixa_simulacao_v5');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return {
      saldoInicialJaneiro: 0,
      dinheiro: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      cheque: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      duplicatas: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      cartao: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      outrosRecebimentos: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      
      tributos: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      fornecedores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      retiradaProLabore: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      salarioEncargos: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      comissaoVendas: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      agua: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      luz: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      aluguel: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      telefoneInternet: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      despesasBancarias: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      despesasFinanceiras: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      honorariosContabeis: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      veiculos: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      escritorio: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      manutencao: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      amortizacao: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      outrasDespesas: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    };
  });

  // Saved years state for simulation history
  const [savedYears, setSavedYears] = useState<{ id: string; label: string; data: any; date: string }[]>(() => {
    try {
      const saved = localStorage.getItem('egn_fluxo_caixa_saved_years');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error(e);
      return [];
    }
  });
  const [newYearLabel, setNewYearLabel] = useState('');
  const [viewingSavedYear, setViewingSavedYear] = useState<{ id: string; label: string; data: any; date: string } | null>(null);

  // Finance Dates (default to start and end of current month)
  const [financeStartDate, setFinanceStartDate] = useState<string>(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return firstDay.toISOString().split('T')[0];
  });
  const [financeEndDate, setFinanceEndDate] = useState<string>(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.toISOString().split('T')[0];
  });

  // Fixed Costs Inputs
  const [fixedRentInput, setFixedRentInput] = useState('');
  const [fixedInternetInput, setFixedInternetInput] = useState('');
  const [fixedElectricityInput, setFixedElectricityInput] = useState('');
  const [fixedWaterInput, setFixedWaterInput] = useState('');
  const [fixedGasInput, setFixedGasInput] = useState('');
  const [fixedSistemasInput, setFixedSistemasInput] = useState('');
  const [fixedMarketingInput, setFixedMarketingInput] = useState('');
  const [fixedContabilidadeInput, setFixedContabilidadeInput] = useState('');
  const [fixedSalariosInput, setFixedSalariosInput] = useState('');
  const [fixedMeiInput, setFixedMeiInput] = useState('');
  const [customFixedCosts, setCustomFixedCosts] = useState<{ label: string; amount: string }[]>([]);

  // Print Receipt Modal State
  const [activePrintReceipt, setActivePrintReceipt] = useState<PrintReceiptData | null>(null);

  useEffect(() => {
    setFixedRentInput(settings?.fixedRent !== undefined ? settings.fixedRent.toString() : '');
    setFixedInternetInput(settings?.fixedInternet !== undefined ? settings.fixedInternet.toString() : '');
    setFixedElectricityInput(settings?.fixedElectricity !== undefined ? settings.fixedElectricity.toString() : '');
    setFixedWaterInput(settings?.fixedWater !== undefined ? settings.fixedWater.toString() : '');
    setFixedGasInput(settings?.fixedGas !== undefined ? settings.fixedGas.toString() : '');
    setFixedSistemasInput(settings?.fixedSistemas !== undefined ? settings.fixedSistemas.toString() : '');
    setFixedMarketingInput(settings?.fixedMarketing !== undefined ? settings.fixedMarketing.toString() : '');
    setFixedContabilidadeInput(settings?.fixedContabilidade !== undefined ? settings.fixedContabilidade.toString() : '');
    setFixedSalariosInput(settings?.fixedSalarios !== undefined ? settings.fixedSalarios.toString() : '');
    setFixedMeiInput(settings?.fixedMei !== undefined ? settings.fixedMei.toString() : '');
    setCustomFixedCosts(
      settings?.customFixedCosts !== undefined
        ? settings.customFixedCosts.map(item => ({ label: item.label, amount: item.amount.toString() }))
        : []
    );
  }, [settings]);

  // Bairros e Taxas de Entrega
  const [neighborhoodName, setNeighborhoodName] = useState('');
  const [neighborhoodFeeInput, setNeighborhoodFeeInput] = useState('0,00');
  const [editingNeighborhoodId, setEditingNeighborhoodId] = useState<string | null>(null);

  const handleNeighborhoodFeeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    if (!digits) {
      setNeighborhoodFeeInput('0,00');
      return;
    }
    const numericValue = parseInt(digits) / 100;
    const formatted = numericValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    setNeighborhoodFeeInput(formatted);
  };

  // Valor Mínimo para Pedido
  const [minOrderInput, setMinOrderInput] = useState<string>(() => {
    if (typeof settings?.minOrderValue === 'number' && settings.minOrderValue > 0) {
      return settings.minOrderValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return '100,00';
  });

  useEffect(() => {
    if (typeof settings?.minOrderValue === 'number' && settings.minOrderValue > 0) {
      setMinOrderInput(settings.minOrderValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    } else if (settings?.minOrderValue === 0) {
      setMinOrderInput('0,00');
    }
  }, [settings?.minOrderValue]);

  const handleMinOrderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    if (!digits) {
      setMinOrderInput('0,00');
      return;
    }
    const numericValue = parseInt(digits, 10) / 100;
    const formatted = numericValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    setMinOrderInput(formatted);
  };

  const handleSaveMinOrder = async () => {
    const digits = minOrderInput.replace(/\D/g, '');
    const numericValue = digits ? parseInt(digits, 10) / 100 : 0;
    const updatedSettings = {
      ...settings,
      minOrderValue: numericValue
    };
    setSettings(updatedSettings);
    try {
      await setDoc(doc(db, 'configuracoes', 'geral'), updatedSettings);
      toast.success(numericValue > 0 
        ? `Valor mínimo de R$ ${numericValue.toFixed(2).replace('.', ',')} salvo com sucesso!` 
        : 'Trava de valor mínimo desativada com sucesso!'
      );
    } catch (err) {
      console.error('Erro ao salvar valor mínimo:', err);
      toast.error('Erro ao salvar valor mínimo no banco de dados.');
    }
  };

  const handleSaveNeighborhood = async () => {
    if (!neighborhoodName.trim()) {
      toast.error('Informe o nome do bairro ou região.');
      return;
    }
    const digits = neighborhoodFeeInput.replace(/\D/g, '');
    const numericFee = digits ? parseInt(digits) / 100 : 0;

    const currentList = settings?.deliveryNeighborhoods || [];
    let updatedList: DeliveryNeighborhood[];

    if (editingNeighborhoodId) {
      updatedList = currentList.map(item => 
        item.id === editingNeighborhoodId 
          ? { ...item, name: neighborhoodName.trim(), fee: numericFee } 
          : item
      );
      toast.success('Bairro atualizado com sucesso!');
    } else {
      const newItem: DeliveryNeighborhood = {
        id: 'bairro_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        name: neighborhoodName.trim(),
        fee: numericFee
      };
      updatedList = [...currentList, newItem];
      toast.success('Bairro adicionado com sucesso!');
    }

    const updatedSettings = {
      ...settings,
      deliveryNeighborhoods: updatedList
    };
    setSettings(updatedSettings);
    setNeighborhoodName('');
    setNeighborhoodFeeInput('0,00');
    setEditingNeighborhoodId(null);

    try {
      await setDoc(doc(db, 'configuracoes', 'geral'), updatedSettings);
    } catch (err) {
      console.error('Erro ao salvar bairro nas configurações:', err);
    }
  };

  const startEditNeighborhood = (item: DeliveryNeighborhood) => {
    setEditingNeighborhoodId(item.id);
    setNeighborhoodName(item.name);
    setNeighborhoodFeeInput(item.fee.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  const cancelEditNeighborhood = () => {
    setEditingNeighborhoodId(null);
    setNeighborhoodName('');
    setNeighborhoodFeeInput('0,00');
  };

  const handleDeleteNeighborhood = async (id: string) => {
    const currentList = settings?.deliveryNeighborhoods || [];
    const updatedList = currentList.filter(item => item.id !== id);
    const updatedSettings = {
      ...settings,
      deliveryNeighborhoods: updatedList
    };
    setSettings(updatedSettings);
    if (editingNeighborhoodId === id) {
      cancelEditNeighborhood();
    }
    toast.success('Bairro excluído com sucesso!');
    try {
      await setDoc(doc(db, 'configuracoes', 'geral'), updatedSettings);
    } catch (err) {
      console.error('Erro ao excluir bairro nas configurações:', err);
    }
  };

  
  const [products, setProducts] = useState<Product[]>(() => {
    return [...initialProducts].sort((a, b) => {
      const oA = typeof a.order === 'number' ? a.order : 9999;
      const oB = typeof b.order === 'number' ? b.order : 9999;
      if (oA !== oB) return oA - oB;
      return (a.title || '').localeCompare(b.title || '');
    });
  });
  const [categories, setCategories] = useState<Category[]>(() => {
    return [...initialCategories].sort((a, b) => {
      const oA = typeof a.order === 'number' ? a.order : 9999;
      const oB = typeof b.order === 'number' ? b.order : 9999;
      return oA - oB;
    });
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [isEditingProduct, setIsEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState<Omit<Product, 'id'>>({
    title: '',
    description: '',
    price: 0,
    oldPrice: 0,
    priceType: 'fixed',
    image: '',
    categoryId: '',
    isMeal: true,
    isCustomCake: false,
    isCustomSandwich: false,
    customFillings: '',
    ingredients: '',
    allowedSides: [],
    isActive: true,
    hasSizes: false,
    sizes: [],
    cakeGalleryId: '',
    isCombo: false,
    comboQuantity: 5,
    comboAllowedProductIds: [],
    isComboOnly: false,
    nutritionalInfo: {
      servingSize: '',
      servingsPerContainer: '',
      calories: '',
      caloriesVd: '',
      carbs: '',
      carbsVd: '',
      totalSugars: '',
      totalSugarsVd: '',
      addedSugars: '',
      addedSugarsVd: '',
      proteins: '',
      proteinsVd: '',
      totalFat: '',
      totalFatVd: '',
      saturatedFat: '',
      saturatedFatVd: '',
      transFat: '',
      transFatVd: '',
      fiber: '',
      fiberVd: '',
      sodium: '',
      sodiumVd: ''
    },
    trackStock: false,
    stockQuantity: 0
  });
  const [showNutritionalForm, setShowNutritionalForm] = useState(false);
  const [priceInput, setPriceInput] = useState('');
  const [sizeForm, setSizeForm] = useState({ name: '', price: '', oldPrice: '' });
  const [editingSizeId, setEditingSizeId] = useState<string | null>(null);
  const [comboDishSearch, setComboDishSearch] = useState('');

  const [isEditingCategory, setIsEditingCategory] = useState<Category | null>(null);
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState({ title: '', order: 0, catalog: 'catalog1' as 'catalog1' | 'catalog2' | 'catalog3' | 'catalog4' | 'both' | 'all' | 'catalog_b2b' });

  const [copied, setCopied] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedHistoryCatalog, setSelectedHistoryCatalog] = useState<'all' | 'catalog1' | 'catalog2' | 'catalog3' | 'catalog4'>('all');
  const [filterValidatedOnly, setFilterValidatedOnly] = useState(false);
  const [orderTypeTab, setOrderTypeTab] = useState<'retail' | 'b2b'>('retail');
  const [customerSearch, setCustomerSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showBirthdaysOnly, setShowBirthdaysOnly] = useState(false);
  const [showBatchSummary, setShowBatchSummary] = useState(false);
  const [orderViewMode, setOrderViewMode] = useState<'week' | 'list' | 'month'>('week');
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [selectedOrderModal, setSelectedOrderModal] = useState<Order | null>(null);
  const [isEditingOrder, setIsEditingOrder] = useState<Order | null>(null);
  const [isEditingCustomer, setIsEditingCustomer] = useState<any | null>(null);
  const [viewingCustomerOrders, setViewingCustomerOrders] = useState<any | null>(null);
  const [editCustomerForm, setEditCustomerForm] = useState<any>({});
  const [editOrderForm, setEditOrderForm] = useState<Partial<Order>>({});
  const [selectedProductId, setSelectedProductId] = useState('');
  const [addItemQuantity, setAddItemQuantity] = useState(1);

  // Manual Clients and Manual Orders
  const [manualCustomers, setManualCustomers] = useState<any[]>([]);
  const [isRegisteringCustomer, setIsRegisteringCustomer] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState<any>({
    name: '',
    phone: '',
    email: '',
    birthday: '',
    isB2B: false,
    managerName: '',
    frequency: '',
    address: '',
    street: '',
    number: '',
    zipCode: '',
    city: ''
  });

  const [isAddingOrder, setIsAddingOrder] = useState(false);
  const [orderCustomerSearch, setOrderCustomerSearch] = useState('');
  const [manualOrderItems, setManualOrderItems] = useState<any[]>([]);
  const [manualOrderForm, setManualOrderForm] = useState({
    customerName: '',
    phone: '',
    email: '',
    address: '',
    street: '',
    number: '',
    zipCode: '',
    city: '',
    pickupDate: '',
    deliveryOption: 'delivery' as 'delivery' | 'pickup',
    observation: '',
    birthday: ''
  });

  const [selectedManualProduct, setSelectedManualProduct] = useState<Product | null>(null);
  const [manualProductQty, setManualProductQty] = useState(1);
  const [selectedManualSize, setSelectedManualSize] = useState<any | null>(null);
  const [selectedManualMealRemovals, setSelectedManualMealRemovals] = useState<string[]>([]);
  const [selectedManualMealSides, setSelectedManualMealSides] = useState<any[]>([]);
  const [selectedManualCakeOptions, setSelectedManualCakeOptions] = useState<any>({
    size: '',
    dough: '',
    fillings: [],
    topping: '',
    topper: '',
    styleNumber: 1
  });

  const scrollToTop = () => {
    const mainContent = document.getElementById('admin-main-content');
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToTop();
  }, [activeTab]);

  const updateOrderFormWithItems = (updatedItems: any[]) => {
    const isCorp = editOrderForm.isB2B || editOrderForm.isPJ;
    const subtotalVal = updatedItems.reduce((acc, it) => acc + (it.price * it.quantity), 0);
    if (isCorp) {
      setEditOrderForm({
        ...editOrderForm,
        items: updatedItems,
        total: subtotalVal,
        subtotal: subtotalVal,
        taxRate: 0,
        taxAmount: 0
      });
    } else {
      setEditOrderForm({
        ...editOrderForm,
        items: updatedItems,
        total: subtotalVal,
        subtotal: subtotalVal,
        taxRate: 0,
        taxAmount: 0
      });
    }
  };
  const [oldPriceInput, setOldPriceInput] = useState('');
  const [expandedOrders, setExpandedOrders] = useState<string[]>([]);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const uniqueCustomers = useMemo(() => {
    const customerMap = new Map<string, {
      name: string;
      phone: string;
      email: string;
      birthday: string;
      address: string;
      orderLanguage?: string;
      lastOrder: any;
      totalOrders: number;
      isB2B: boolean;
      managerName: string;
      street: string;
      number: string;
      zipCode: string;
      city: string;
      frequency: string;
      orders: Order[];
    }>();

    orders.forEach(order => {
      const isCorp = !!(order.isB2B || order.isPJ);
      const name = isCorp ? (order.b2bCompanyName || order.customerName) : order.customerName;
      const phone = order.phone || '';
      const email = order.email || '';
      const key = phone || email || name;
      if (!key) return;

      if (!customerMap.has(key)) {
        customerMap.set(key, {
          name: name,
          phone: phone,
          email: email,
          birthday: order.birthday || '',
          address: isCorp ? (order.b2bAddress || order.address || '') : (order.address || ''),
          orderLanguage: order.orderLanguage,
          lastOrder: order.createdAt,
          totalOrders: 1,
          isB2B: isCorp,
          managerName: order.b2bManagerName || '',
          street: order.street || '',
          number: order.number || '',
          zipCode: isCorp ? (order.b2bZipCode || order.zipCode || '') : (order.zipCode || ''),
          city: isCorp ? (order.b2bCity || order.city || '') : (order.city || ''),
          frequency: order.b2bFrequency || '',
          orders: [order]
        });
      } else {
        const existing = customerMap.get(key)!;
        existing.totalOrders += 1;
        existing.orders.push(order);
        if (isCorp) {
          existing.isB2B = true;
          if (order.b2bCompanyName) existing.name = order.b2bCompanyName;
          if (order.b2bManagerName) existing.managerName = order.b2bManagerName;
          if (order.b2bAddress) existing.address = order.b2bAddress;
          if (order.b2bZipCode) existing.zipCode = order.b2bZipCode;
          if (order.b2bCity) existing.city = order.b2bCity;
          if (order.b2bFrequency) existing.frequency = order.b2bFrequency;
        } else {
          if (order.street) existing.street = order.street;
          if (order.number) existing.number = order.number;
          if (order.zipCode) existing.zipCode = order.zipCode;
          if (order.city) existing.city = order.city;
        }
        if (order.createdAt?.toDate && existing.lastOrder?.toDate) {
          if (order.createdAt.toDate() > existing.lastOrder.toDate()) {
            existing.lastOrder = order.createdAt;
            if (!isCorp) {
              existing.name = order.customerName;
              existing.birthday = order.birthday || existing.birthday;
              existing.address = order.address || existing.address;
            }
            existing.orderLanguage = order.orderLanguage || existing.orderLanguage;
          }
        }
      }
    });

    return Array.from(customerMap.values());
  }, [orders]);

  const combinedCustomers = useMemo(() => {
    const list = [...uniqueCustomers];
    manualCustomers.forEach(mc => {
      const exists = uniqueCustomers.some(uc => {
        const ucPhoneClean = (uc.phone || '').replace(/\D/g, '');
        const mcPhoneClean = (mc.phone || '').replace(/\D/g, '');
        const hasMatchingPhone = ucPhoneClean && mcPhoneClean && ucPhoneClean === mcPhoneClean;

        const ucEmailClean = (uc.email || '').trim().toLowerCase();
        const mcEmailClean = (mc.email || '').trim().toLowerCase();
        const hasMatchingEmail = ucEmailClean && mcEmailClean && ucEmailClean === mcEmailClean;

        const ucNameClean = (uc.name || '').trim().toLowerCase();
        const mcNameClean = (mc.name || '').trim().toLowerCase();
        const hasMatchingName = ucNameClean && mcNameClean && ucNameClean === mcNameClean;

        return hasMatchingPhone || hasMatchingEmail || hasMatchingName;
      });
      if (!exists) {
        list.push({
          id: mc.id,
          name: mc.name,
          phone: mc.phone || '',
          email: mc.email || '',
          birthday: mc.birthday || '',
          address: mc.address || '',
          street: mc.street || '',
          number: mc.number || '',
          zipCode: mc.zipCode || '',
          city: mc.city || '',
          totalOrders: 0,
          isB2B: mc.isB2B || false,
          managerName: mc.managerName || '',
          frequency: mc.frequency || '',
          orders: [],
          lastOrder: null,
          createdAt: mc.createdAt || null
        });
      }
    });
    return list;
  }, [uniqueCustomers, manualCustomers]);

  const slugify = (text: string) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-');
  };

  const handleBrandNameChange = (name: string) => {
    setSettings(prev => ({
      ...prev,
      brandName: name,
      slug: slugify(name)
    }));
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    setLoading(true);
    ensureDefaultCatalogSeeded();

    const unsubProducts = onSnapshot(collection(db, 'produtos'), (snapshot) => {
      const fetched = snapshot.docs.map(doc => {
        const data = doc.data() as Product;
        const matchingInitial = initialProducts.find(ip => ip.title.trim().toLowerCase() === data.title?.trim().toLowerCase() || ip.id === doc.id);
        const image = data.image || matchingInitial?.image || '';
        return { id: doc.id, ...data, image } as Product;
      });
      if (fetched.length > 0) {
        const sorted = fetched.sort((a, b) => {
          const oA = typeof a.order === 'number' ? a.order : 9999;
          const oB = typeof b.order === 'number' ? b.order : 9999;
          if (oA !== oB) return oA - oB;
          return (a.title || '').localeCompare(b.title || '');
        });
        setProducts(sorted);
      } else {
        const sorted = [...initialProducts].sort((a, b) => {
          const oA = typeof a.order === 'number' ? a.order : 9999;
          const oB = typeof b.order === 'number' ? b.order : 9999;
          if (oA !== oB) return oA - oB;
          return (a.title || '').localeCompare(b.title || '');
        });
        setProducts(sorted);
      }
      setLoading(false);
    }, (error) => {
      console.error('Admin: Erro ao carregar produtos:', error);
      const sorted = [...initialProducts].sort((a, b) => {
        const oA = typeof a.order === 'number' ? a.order : 9999;
        const oB = typeof b.order === 'number' ? b.order : 9999;
        if (oA !== oB) return oA - oB;
        return (a.title || '').localeCompare(b.title || '');
      });
      setProducts(sorted);
      setLoading(false);
    });

    const unsubCategories = onSnapshot(collection(db, 'categorias'), (snapshot) => {
      const catMap = new Map<string, Category>();
      snapshot.docs.forEach(doc => {
        catMap.set(doc.id, { id: doc.id, ...doc.data() } as Category);
      });
      const fetched = Array.from(catMap.values());
      if (fetched.length > 0) {
        const sorted = fetched.sort((a, b) => (typeof a.order === 'number' ? a.order : 9999) - (typeof b.order === 'number' ? b.order : 9999));
        setCategories(sorted);
      } else {
        const sorted = [...initialCategories].sort((a, b) => (typeof a.order === 'number' ? a.order : 9999) - (typeof b.order === 'number' ? b.order : 9999));
        setCategories(sorted);
      }
    }, (error) => {
      console.error('Admin: Erro ao carregar categorias:', error);
      const sorted = [...initialCategories].sort((a, b) => (typeof a.order === 'number' ? a.order : 9999) - (typeof b.order === 'number' ? b.order : 9999));
      setCategories(sorted);
    });

    const unsubOrders = onSnapshot(query(collection(db, 'pedidos'), orderBy('createdAt', 'desc')), (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    }, (error) => {
      console.error('Admin: Erro ao carregar pedidos:', error);
    });

    const unsubSides = onSnapshot(collection(db, 'acompanhamentos'), (snapshot) => {
      setSides(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Side)));
    }, (error) => {
      console.error('Admin: Erro ao carregar acompanhamentos:', error);
    });

    const unsubGalleries = onSnapshot(collection(db, 'galerias'), (snapshot) => {
      setGalleries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ImageGallery)));
    }, (error) => {
      console.error('Admin: Erro ao carregar galerias:', error);
    });

    const unsubVarCosts = onSnapshot(collection(db, 'custos_variaveis'), (snapshot) => {
      setVariableCosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VariableCost)));
    }, (error) => {
      console.error('Admin: Erro ao carregar custos variaveis:', error);
    });

    const unsubManualCustomers = onSnapshot(collection(db, 'clientes'), (snapshot) => {
      setManualCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error('Admin: Erro ao carregar clientes:', error);
    });

    return () => {
      unsubProducts();
      unsubCategories();
      unsubOrders();
      unsubSides();
      unsubGalleries();
      unsubVarCosts();
      unsubManualCustomers();
    };
  }, [isLoggedIn]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const correctPassword = settings?.adminPassword || 'admin123';
    if (password === correctPassword) {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.warn('Admin: Erro de autenticação anônima do Firebase:', error);
        // Não bloqueia o login se o provedor anônimo não estiver ativado no console do Firebase
      }
      setIsLoggedIn(true);
      toast.success('Acesso realizado com sucesso!');
    } else {
      toast.error('Senha incorreta!');
    }
  };

  const handleSaveFixedCosts = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updatedSettings = {
        ...settings,
        fixedRent: fixedRentInput ? parseFloat(fixedRentInput.replace(',', '.')) : undefined,
        fixedInternet: fixedInternetInput ? parseFloat(fixedInternetInput.replace(',', '.')) : undefined,
        fixedElectricity: fixedElectricityInput ? parseFloat(fixedElectricityInput.replace(',', '.')) : undefined,
        fixedWater: fixedWaterInput ? parseFloat(fixedWaterInput.replace(',', '.')) : undefined,
        fixedGas: fixedGasInput ? parseFloat(fixedGasInput.replace(',', '.')) : undefined,
        fixedSistemas: fixedSistemasInput ? parseFloat(fixedSistemasInput.replace(',', '.')) : undefined,
        fixedMarketing: fixedMarketingInput ? parseFloat(fixedMarketingInput.replace(',', '.')) : undefined,
        fixedContabilidade: fixedContabilidadeInput ? parseFloat(fixedContabilidadeInput.replace(',', '.')) : undefined,
        fixedSalarios: fixedSalariosInput ? parseFloat(fixedSalariosInput.replace(',', '.')) : undefined,
        fixedMei: fixedMeiInput ? parseFloat(fixedMeiInput.replace(',', '.')) : undefined,
        customFixedCosts: customFixedCosts
          .filter(item => item.label.trim() !== '' && item.amount.trim() !== '')
          .map(item => ({ label: item.label, amount: parseFloat(item.amount.replace(',', '.')) || 0 })),
      };

      if (fixedRentInput === '') delete updatedSettings.fixedRent;
      if (fixedInternetInput === '') delete updatedSettings.fixedInternet;
      if (fixedElectricityInput === '') delete updatedSettings.fixedElectricity;
      if (fixedWaterInput === '') delete updatedSettings.fixedWater;
      if (fixedGasInput === '') delete updatedSettings.fixedGas;
      if (fixedSistemasInput === '') delete updatedSettings.fixedSistemas;
      if (fixedMarketingInput === '') delete updatedSettings.fixedMarketing;
      if (fixedContabilidadeInput === '') delete updatedSettings.fixedContabilidade;
      if (fixedSalariosInput === '') delete updatedSettings.fixedSalarios;
      if (fixedMeiInput === '') delete updatedSettings.fixedMei;

      await setDoc(doc(db, 'configuracoes', 'geral'), updatedSettings);
      setSettings(updatedSettings);
      toast.success('Custos fixos mensais salvos com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar custos fixos:', err);
      toast.error('Erro ao salvar custos fixos.');
    }
  };

  const handleAddVarCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVarCost.description || !varCostAmountInput) {
      toast.error('Preencha a descrição e o valor do custo variável.');
      return;
    }
    const amountVal = parseFloat(varCostAmountInput.replace(',', '.'));
    if (isNaN(amountVal) || amountVal <= 0) {
      toast.error('Digite um valor numérico válido maior que zero.');
      return;
    }

    try {
      const dataToSave = {
        description: newVarCost.description,
        amount: amountVal,
        date: newVarCost.date || new Date().toISOString().split('T')[0]
      };

      if (isEditingVarCost) {
        await updateDoc(doc(db, 'custos_variaveis', isEditingVarCost.id), dataToSave);
        toast.success('Custo variável atualizado!');
        setIsEditingVarCost(null);
      } else {
        await addDoc(collection(db, 'custos_variaveis'), dataToSave);
        toast.success('Custo variável adicionado!');
      }

      setNewVarCost({ description: '', amount: 0, date: new Date().toISOString().split('T')[0] });
      setVarCostAmountInput('');
    } catch (err) {
      console.error('Erro ao salvar custo variável:', err);
      toast.error('Erro ao salvar custo variável.');
    }
  };

  const handleDeleteVarCost = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este custo variável?')) return;
    try {
      await deleteDoc(doc(db, 'custos_variaveis', id));
      toast.success('Custo variável excluído!');
    } catch (err) {
      console.error('Erro ao excluir custo variável:', err);
      toast.error('Erro ao excluir custo variável.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void, imageType: boolean | 'logo' | 'background' | 'catalog' | 'product' = 'product') => {
    const file = e.target.files?.[0];
    if (file) {
      // Compress image if it's too large
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          let MAX_WIDTH = 600;
          let MAX_HEIGHT = 600;
          let quality = 0.5;

          if (imageType === 'logo') {
            MAX_WIDTH = 250;
            MAX_HEIGHT = 250;
            quality = 0.6;
          } else if (imageType === 'background') {
            MAX_WIDTH = 800;
            MAX_HEIGHT = 800;
            quality = 0.4;
          } else if (imageType === 'catalog') {
            MAX_WIDTH = 450;
            MAX_HEIGHT = 450;
            quality = 0.4;
          } else if (imageType === 'product') {
            MAX_WIDTH = 600;
            MAX_HEIGHT = 600;
            quality = 0.5;
          } else if (imageType === true) {
            MAX_WIDTH = 450;
            MAX_HEIGHT = 450;
            quality = 0.4;
          } else if (imageType === false) {
            MAX_WIDTH = 600;
            MAX_HEIGHT = 600;
            quality = 0.5;
          }
          
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          callback(compressedBase64);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const addCakeOptionItem = (key: 'cakeSizes' | 'cakeDoughs' | 'cakeFillings' | 'cakeToppings' | 'cakeToppers', defaultValue: string = '') => {
    setSettings(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), defaultValue]
    }));
  };

  const removeCakeOptionItem = (key: 'cakeSizes' | 'cakeDoughs' | 'cakeFillings' | 'cakeToppings' | 'cakeToppers', index: number) => {
    setSettings(prev => ({
      ...prev,
      [key]: (prev[key] || []).filter((_: any, i: number) => i !== index)
    }));
  };

  const updateCakeOptionItem = (key: 'cakeSizes' | 'cakeDoughs' | 'cakeFillings' | 'cakeToppings' | 'cakeToppers', index: number, value: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: (prev[key] || []).map((v: string, i: number) => i === index ? value : v)
    }));
  };

  const saveSettings = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 10000)
      );
      
      const updatedSettings = {
        ...settings,
        whatsappNumber: formatBRPhone(settings.whatsappNumber || ''),
        whatsappCountryCode: '+55',
        language: 'pt' as const,
        currency: 'BRL' as const
      };
      
      await Promise.race([
        setDoc(doc(db, 'configuracoes', 'geral'), updatedSettings),
        timeoutPromise
      ]);
      
      toast.success('Configurações salvas com sucesso!');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Erro ao salvar configurações:', err);
      toast.error('Erro ao salvar configurações. Verifique sua conexão ou o tamanho das imagens.');
    } finally {
      setTimeout(() => setIsSaving(false), 500);
    }
  };

  const handlePriceChange = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      setPriceInput('0,00');
      setNewProduct(prev => ({ ...prev, price: 0 }));
      return;
    }
    
    const numericValue = parseInt(digits) / 100;
    const formatted = numericValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    setPriceInput(formatted);
    setNewProduct(prev => ({ ...prev, price: numericValue }));
  };

  const handleOldPriceChange = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      setOldPriceInput('0,00');
      setNewProduct(prev => ({ ...prev, oldPrice: 0 }));
      return;
    }
    
    const numericValue = parseInt(digits) / 100;
    const formatted = numericValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    setOldPriceInput(formatted);
    setNewProduct(prev => ({ ...prev, oldPrice: numericValue }));
  };

  const handleAddSizeOption = () => {
    if (!sizeForm.name) {
      toast.error('Informe ao menos o nome do tamanho.');
      return;
    }
    const priceVal = sizeForm.price ? (parseFloat(sizeForm.price.replace(/\D/g, '')) / 100) : 0;
    
    if (editingSizeId) {
      setNewProduct((prev: any) => ({
        ...prev,
        sizes: (prev.sizes || []).map((s: any) => 
          s.id === editingSizeId ? { ...s, name: sizeForm.name, price: priceVal } : s
        )
      }));
      setEditingSizeId(null);
      setSizeForm({ name: '', price: '', oldPrice: '' });
      toast.success('Opção de tamanho atualizada!');
    } else {
      const newSizeOption = {
        id: Math.random().toString(36).substr(2, 9),
        name: sizeForm.name,
        price: priceVal
      };
      
      setNewProduct((prev: any) => ({
        ...prev,
        sizes: [...(prev.sizes || []), newSizeOption]
      }));
      
      setSizeForm({ name: '', price: '', oldPrice: '' });
      toast.success('Opção de tamanho adicionada!');
    }
  };

    const handleSyncDefaultCatalog = async () => {
    if (!window.confirm("Deseja sincronizar todos os itens e categorias padrão com o banco de dados? As informações e fotos serão gravadas no Firebase.")) {
      return;
    }
    try {
      toast.loading("Sincronizando catálogo base com o Firebase...");
      for (const cat of initialCategories) {
        await setDoc(doc(db, "categorias", cat.id), cleanFirestoreData(cat), { merge: true });
      }
      for (const prod of initialProducts) {
        const existing = products.find(p => p.id === prod.id || p.title.trim().toLowerCase() === prod.title.trim().toLowerCase());
        const docId = existing ? existing.id : prod.id;
        await setDoc(doc(db, "produtos", docId), cleanFirestoreData({
          ...prod,
          id: docId
        }), { merge: true });
      }
      toast.dismiss();
      toast.success("Catálogo base sincronizado no Firebase com sucesso!");
    } catch (err) {
      console.error('Erro ao sincronizar catálogo:', err);
      toast.dismiss();
      toast.error("Erro ao sincronizar catálogo.");
    }
  };

  const handleCopyCatalogJSON = () => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        totalCategories: categories.length,
        totalProducts: products.length,
        categories: categories.map(c => cleanFirestoreData(c)),
        products: products.map(p => cleanFirestoreData(p))
      };
      navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      toast.success(`Dados copiados! (${products.length} itens e ${categories.length} categorias exportados)`);
    } catch (err) {
      console.error('Erro ao exportar catálogo:', err);
      toast.error('Erro ao copiar dados para a área de transferência.');
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!newProduct.title || !newProduct.categoryId) {
        toast.error('Por favor, preencha o título e a categoria.');
        return;
      }

      const productPayload: Omit<Product, 'id'> = {
        title: (newProduct.title || '').trim(),
        description: (newProduct.description || '').trim(),
        price: typeof newProduct.price === 'number' && Number.isFinite(newProduct.price) ? newProduct.price : 0,
        oldPrice: typeof newProduct.oldPrice === 'number' && Number.isFinite(newProduct.oldPrice) ? newProduct.oldPrice : 0,
        priceType: newProduct.priceType || 'fixed',
        image: (newProduct.image || '').trim(),
        categoryId: newProduct.categoryId,
        isMeal: Boolean(newProduct.isMeal),
        isCustomCake: Boolean(newProduct.isCustomCake),
        isCustomSandwich: Boolean(newProduct.isCustomSandwich),
        customFillings: newProduct.customFillings || '',
        ingredients: newProduct.ingredients || '',
        allowedSides: Array.isArray(newProduct.allowedSides) ? newProduct.allowedSides : [],
        isActive: newProduct.isActive !== false,
        hasSizes: Boolean(newProduct.hasSizes),
        sizes: Array.isArray(newProduct.sizes) ? newProduct.sizes : [],
        cakeGalleryId: newProduct.cakeGalleryId || '',
        isCombo: Boolean(newProduct.isCombo),
        comboQuantity: typeof newProduct.comboQuantity === 'number' && Number.isFinite(newProduct.comboQuantity) ? newProduct.comboQuantity : 5,
        comboAllowedProductIds: Array.isArray(newProduct.comboAllowedProductIds) ? newProduct.comboAllowedProductIds : [],
        isComboOnly: Boolean(newProduct.isComboOnly),
        order: typeof newProduct.order === 'number' && Number.isFinite(newProduct.order) ? newProduct.order : 0,
        nutritionalInfo: {
          servingSize: newProduct.nutritionalInfo?.servingSize || '',
          servingsPerContainer: newProduct.nutritionalInfo?.servingsPerContainer || '',
          calories: newProduct.nutritionalInfo?.calories || '',
          caloriesVd: newProduct.nutritionalInfo?.caloriesVd || '',
          carbs: newProduct.nutritionalInfo?.carbs || '',
          carbsVd: newProduct.nutritionalInfo?.carbsVd || '',
          totalSugars: newProduct.nutritionalInfo?.totalSugars || '',
          totalSugarsVd: newProduct.nutritionalInfo?.totalSugarsVd || '',
          addedSugars: newProduct.nutritionalInfo?.addedSugars || '',
          addedSugarsVd: newProduct.nutritionalInfo?.addedSugarsVd || '',
          proteins: newProduct.nutritionalInfo?.proteins || '',
          proteinsVd: newProduct.nutritionalInfo?.proteinsVd || '',
          totalFat: newProduct.nutritionalInfo?.totalFat || '',
          totalFatVd: newProduct.nutritionalInfo?.totalFatVd || '',
          saturatedFat: newProduct.nutritionalInfo?.saturatedFat || '',
          saturatedFatVd: newProduct.nutritionalInfo?.saturatedFatVd || '',
          transFat: newProduct.nutritionalInfo?.transFat || '',
          transFatVd: newProduct.nutritionalInfo?.transFatVd || '',
          fiber: newProduct.nutritionalInfo?.fiber || '',
          fiberVd: newProduct.nutritionalInfo?.fiberVd || '',
          sodium: newProduct.nutritionalInfo?.sodium || '',
          sodiumVd: newProduct.nutritionalInfo?.sodiumVd || ''
        },
        trackStock: Boolean(newProduct.trackStock),
        stockQuantity: typeof newProduct.stockQuantity === 'number' && Number.isFinite(newProduct.stockQuantity) ? Math.max(0, newProduct.stockQuantity) : 0
      };

      if (isEditingProduct) {
        const updatedProduct: Product = {
          id: isEditingProduct.id,
          ...productPayload
        };
        setProducts(prev => prev.map(p => p.id === isEditingProduct.id ? updatedProduct : p));
        await setDoc(doc(db, 'produtos', isEditingProduct.id), cleanFirestoreData(updatedProduct), { merge: true });
        
        // Sincronizar estoque automaticamente com pratos irmãos que tenham o mesmo nome
        const dishKey = getCanonicalDishKey(updatedProduct.title);
        if (dishKey) {
          const siblings = products.filter(p => p.id !== updatedProduct.id && !p.isCombo && getCanonicalDishKey(p.title) === dishKey);
          for (const sib of siblings) {
            try {
              await setDoc(doc(db, 'produtos', sib.id), cleanFirestoreData({
                trackStock: Boolean(updatedProduct.trackStock),
                stockQuantity: typeof updatedProduct.stockQuantity === 'number' && Number.isFinite(updatedProduct.stockQuantity) ? Math.max(0, updatedProduct.stockQuantity) : 0
              }), { merge: true });
            } catch (err) {
              console.warn('Erro ao sincronizar prato irmão:', sib.title, err);
            }
          }
        }

        setIsEditingProduct(null);
        toast.success('Produto atualizado com sucesso!');
      } else {
        const existingCategoryProducts = products.filter(p => p.categoryId === newProduct.categoryId);
        const maxOrder = existingCategoryProducts.reduce((max, p) => Math.max(max, typeof p.order === 'number' ? p.order : 0), 0);
        const newProdWithOrder = { 
          ...productPayload, 
          isActive: true,
          order: existingCategoryProducts.length > 0 ? maxOrder + 1 : 0
        };
        const docRef = await addDoc(collection(db, 'produtos'), cleanFirestoreData(newProdWithOrder));
        const createdProduct: Product = { id: docRef.id, ...newProdWithOrder };
        setProducts(prev => {
          if (prev.some(p => p.id === createdProduct.id)) return prev;
          return [...prev, createdProduct];
        });
        toast.success('Produto adicionado com sucesso!');
      }

      setNewProduct({ 
        title: '', 
        description: '', 
        price: 0, 
        priceType: 'fixed',
        image: '', 
        categoryId: '',
        isMeal: true,
        isCustomCake: false,
        isCustomSandwich: false,
        customFillings: '',
        ingredients: '',
        allowedSides: [],
        isActive: true,
        oldPrice: 0,
        hasSizes: false,
        sizes: [],
        cakeGalleryId: '',
        isCombo: false,
        comboQuantity: 5,
        comboAllowedProductIds: [],
        isComboOnly: false,
        nutritionalInfo: {
          servingSize: '',
          servingsPerContainer: '',
          calories: '',
          caloriesVd: '',
          carbs: '',
          carbsVd: '',
          totalSugars: '',
          totalSugarsVd: '',
          addedSugars: '',
          addedSugarsVd: '',
          proteins: '',
          proteinsVd: '',
          totalFat: '',
          totalFatVd: '',
          saturatedFat: '',
          saturatedFatVd: '',
          transFat: '',
          transFatVd: '',
          fiber: '',
          fiberVd: '',
          sodium: '',
          sodiumVd: ''
        },
        trackStock: false,
        stockQuantity: 0
      });
      setPriceInput('');
      setOldPriceInput('');
      setEditingSizeId(null);
      setSizeForm({ name: '', price: '', oldPrice: '' });
    } catch (err) {
      console.error('Erro ao salvar produto:', err);
      toast.error('Erro ao salvar produto.');
    }
  };

  const toggleProductStatus = async (product: Product) => {
    try {
      const newActive = product.isActive === false;
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, isActive: newActive } : p));
      await setDoc(doc(db, 'produtos', product.id), { ...product, isActive: newActive }, { merge: true });
      toast.success(newActive ? 'Produto ativado!' : 'Produto desativado!');
    } catch (err) {
      console.error('Erro ao alterar status:', err);
      toast.error('Erro ao alterar status do produto.');
    }
  };

  const moveCategory = async (id: string, direction: 'up' | 'down') => {
    const index = categories.findIndex(c => c.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === categories.length - 1) return;

    const otherIndex = direction === 'up' ? index - 1 : index + 1;
    const newCategories = [...categories];
    const [movedCat] = newCategories.splice(index, 1);
    newCategories.splice(otherIndex, 0, movedCat);

    const updatedCategories = newCategories.map((c, idx) => ({
      ...c,
      order: idx + 1
    }));

    setCategories(updatedCategories);

    try {
      await Promise.all(
        updatedCategories.map(cat => 
          setDoc(doc(db, 'categorias', cat.id), cleanFirestoreData(cat), { merge: true })
        )
      );
      toast.success('Ordem das categorias atualizada com sucesso!');
    } catch (err) {
      console.error('Admin: Erro ao reordenar categorias:', err);
      toast.error('Erro ao salvar nova ordem das categorias no banco.');
    }
  };

  const moveProduct = async (productId: string, categoryId: string, direction: 'up' | 'down') => {
    const catProducts = products
      .filter(p => p.categoryId === categoryId)
      .sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : 9999;
        const orderB = typeof b.order === 'number' ? b.order : 9999;
        if (orderA !== orderB) return orderA - orderB;
        return (a.title || '').localeCompare(b.title || '');
      });

    const index = catProducts.findIndex(p => p.id === productId);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === catProducts.length - 1) return;

    const otherIndex = direction === 'up' ? index - 1 : index + 1;
    const newCatProducts = [...catProducts];
    const [movedProd] = newCatProducts.splice(index, 1);
    newCatProducts.splice(otherIndex, 0, movedProd);

    const updatedCatProducts = newCatProducts.map((p, idx) => ({
      ...p,
      order: idx + 1
    }));

    setProducts(prev => {
      const otherProducts = prev.filter(p => p.categoryId !== categoryId);
      return [...otherProducts, ...updatedCatProducts];
    });

    try {
      await Promise.all(
        updatedCatProducts.map(p => 
          setDoc(doc(db, 'produtos', p.id), cleanFirestoreData(p), { merge: true })
        )
      );
      toast.success('Ordem dos produtos atualizada!');
    } catch (error) {
      console.error('Admin: Erro ao ordenar produto:', error);
      toast.error('Erro ao atualizar a ordem do produto');
    }
  };

  const moveProductToExtremity = async (productId: string, categoryId: string, position: 'top' | 'bottom') => {
    const catProducts = products
      .filter(p => p.categoryId === categoryId)
      .sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : 9999;
        const orderB = typeof b.order === 'number' ? b.order : 9999;
        if (orderA !== orderB) return orderA - orderB;
        return (a.title || '').localeCompare(b.title || '');
      });

    if (catProducts.length <= 1) return;
    const index = catProducts.findIndex(p => p.id === productId);
    if (index === -1) return;

    const newCatProducts = [...catProducts];
    const [movedProd] = newCatProducts.splice(index, 1);
    if (position === 'top') {
      newCatProducts.unshift(movedProd);
    } else {
      newCatProducts.push(movedProd);
    }

    const updatedCatProducts = newCatProducts.map((p, idx) => ({
      ...p,
      order: idx + 1
    }));

    setProducts(prev => {
      const otherProducts = prev.filter(p => p.categoryId !== categoryId);
      return [...otherProducts, ...updatedCatProducts];
    });

    try {
      await Promise.all(
        updatedCatProducts.map(p => 
          setDoc(doc(db, 'produtos', p.id), cleanFirestoreData(p), { merge: true })
        )
      );
      toast.success(position === 'top' ? 'Prato movido para o início da categoria!' : 'Prato movido para o fim da categoria!');
    } catch (error) {
      console.error('Admin: Erro ao mover produto:', error);
      toast.error('Erro ao atualizar posição do produto');
    }
  };

  const normalizeCategoryProductsOrder = async (categoryId: string) => {
    const catProducts = products
      .filter(p => p.categoryId === categoryId)
      .sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : 9999;
        const orderB = typeof b.order === 'number' ? b.order : 9999;
        if (orderA !== orderB) return orderA - orderB;
        return (a.title || '').localeCompare(b.title || '');
      });

    const updatedCatProducts = catProducts.map((p, idx) => ({
      ...p,
      order: idx + 1
    }));

    setProducts(prev => {
      const otherProducts = prev.filter(p => p.categoryId !== categoryId);
      return [...otherProducts, ...updatedCatProducts];
    });

    try {
      await Promise.all(
        updatedCatProducts.map(p => 
          setDoc(doc(db, 'produtos', p.id), cleanFirestoreData(p), { merge: true })
        )
      );
      toast.success('Ordem sequencial (1, 2, 3...) salva com sucesso!');
    } catch (error) {
      console.error('Admin: Erro ao normalizar ordem:', error);
      toast.error('Erro ao normalizar ordem dos produtos');
    }
  };

  const sortCategoryAlphabetically = async (categoryId: string) => {
    const catProducts = products
      .filter(p => p.categoryId === categoryId)
      .sort((a, b) => (a.title || '').localeCompare(b.title || ''));

    const updatedCatProducts = catProducts.map((p, idx) => ({
      ...p,
      order: idx + 1
    }));

    setProducts(prev => {
      const otherProducts = prev.filter(p => p.categoryId !== categoryId);
      return [...otherProducts, ...updatedCatProducts];
    });

    try {
      await Promise.all(
        updatedCatProducts.map(p => 
          setDoc(doc(db, 'produtos', p.id), cleanFirestoreData(p), { merge: true })
        )
      );
      toast.success('Ordem alfabética (A-Z) aplicada e salva com sucesso!');
    } catch (error) {
      console.error('Admin: Erro ao ordenar A-Z:', error);
      toast.error('Erro ao ordenar produtos');
    }
  };

  const handleAddSide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSide.name) return;

    try {
      if (isEditingSide) {
        const updatedSide: Side = { id: isEditingSide.id, ...newSide };
        setSides(prev => prev.map(s => s.id === isEditingSide.id ? updatedSide : s));
        await setDoc(doc(db, 'acompanhamentos', isEditingSide.id), cleanFirestoreData(updatedSide), { merge: true });
        toast.success('Acompanhamento atualizado!');
      } else {
        const docRef = await addDoc(collection(db, 'acompanhamentos'), cleanFirestoreData(newSide));
        setSides(prev => {
          if (prev.some(s => s.id === docRef.id)) return prev;
          return [...prev, { id: docRef.id, ...newSide } as Side];
        });
        toast.success('Acompanhamento adicionado!');
      }
      setNewSide({ name: '', price: 0, type: 'side' });
      setSidePriceInput('');
      setIsEditingSide(null);
    } catch (error) {
      console.error('Error adding side:', error);
      toast.error('Erro ao salvar acompanhamento');
    }
  };

  const deleteSide = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Acompanhamento',
      message: 'Tem certeza que deseja excluir este acompanhamento?',
      onConfirm: async () => {
        try {
          setSides(prev => prev.filter(s => s.id !== id));
          await deleteDoc(doc(db, 'acompanhamentos', id));
          toast.success('Acompanhamento excluído!');
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          console.error('Erro ao excluir acompanhamento:', error);
          toast.error('Erro ao excluir');
        }
      }
    });
  };

  const handleSidePriceChange = (val: string) => {
    setSidePriceInput(val);
    const numeric = parseFloat(val.replace(',', '.'));
    if (!isNaN(numeric)) {
      setNewSide({ ...newSide, price: numeric });
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingCategory) return;

    try {
      const trimmedTitle = (newCategory.title || '').trim();
      if (!trimmedTitle) {
        toast.error('Por favor, preencha o título da categoria.');
        return;
      }

      setIsSubmittingCategory(true);

      if (isEditingCategory) {
        const updatedCat: Category = {
          ...isEditingCategory,
          title: trimmedTitle,
          catalog: newCategory.catalog || 'both'
        };
        setCategories(prev => prev.map(c => c.id === isEditingCategory.id ? updatedCat : c));
        await setDoc(doc(db, 'categorias', isEditingCategory.id), cleanFirestoreData(updatedCat), { merge: true });
        setIsEditingCategory(null);
        toast.success('Categoria atualizada com sucesso!');
      } else {
        const targetCatalog = newCategory.catalog || 'catalog1';
        
        // Prevent adding duplicate category with the same title in the same catalog
        const alreadyExists = categories.some(
          c => c.title.trim().toLowerCase() === trimmedTitle.toLowerCase() &&
               (c.catalog === targetCatalog || c.catalog === 'both' || targetCatalog === 'both' || c.catalog === 'all')
        );

        if (alreadyExists) {
          toast.error('Já existe uma categoria com este nome.');
          return;
        }

        const maxOrder = categories.reduce((max, c) => Math.max(max, c.order || 0), 0);
        const newCatData = {
          title: trimmedTitle,
          order: maxOrder + 1,
          catalog: targetCatalog
        };
        const docRef = await addDoc(collection(db, 'categorias'), cleanFirestoreData(newCatData));
        setCategories(prev => {
          if (prev.some(c => c.id === docRef.id)) return prev;
          return [...prev, { id: docRef.id, ...newCatData } as Category];
        });
        toast.success('Categoria adicionada com sucesso!');
      }
      setNewCategory({ title: '', order: 0, catalog: 'catalog1' });
    } catch (err: any) {
      console.error('Erro ao salvar categoria:', err);
      if (err.message?.includes('permission-denied')) {
        toast.error('Erro de permissão: Você não tem autorização para salvar. Verifique se está logado corretamente.');
      } else {
        toast.error('Erro ao salvar categoria. Verifique sua conexão.');
      }
    } finally {
      setIsSubmittingCategory(false);
    }
  };

  const deleteProduct = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Produto',
      message: 'Deseja realmente excluir este produto? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        try {
          setProducts(prev => prev.filter(p => p.id !== id));
          await deleteDoc(doc(db, 'produtos', id));
          await markProductAsDeleted(id);
          toast.success('Produto excluído com sucesso!');
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          console.error('Erro ao excluir produto:', err);
          toast.error('Erro ao excluir produto.');
        }
      }
    });
  };

  const deleteCategory = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Categoria',
      message: 'Deseja realmente excluir esta categoria? Todos os produtos vinculados a ela ficarão sem categoria.',
      onConfirm: async () => {
        try {
          setCategories(prev => prev.filter(c => c.id !== id));
          await deleteDoc(doc(db, 'categorias', id));
          await markCategoryAsDeleted(id);
          toast.success('Categoria excluída com sucesso!');
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          console.error('Erro ao excluir categoria:', err);
          toast.error('Erro ao excluir categoria.');
        }
      }
    });
  };

  const deleteOrder = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Pedido',
      message: 'Deseja realmente excluir este pedido do histórico?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'pedidos', id));
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          alert('Erro ao excluir pedido.');
        }
      }
    });
  };

  const updateOrderPaymentStatus = async (orderId: string, status: 'pending' | 'half' | 'full') => {
    try {
      await updateDoc(doc(db, 'pedidos', orderId), {
        paymentStatus: status
      });
      if (selectedOrderModal && selectedOrderModal.id === orderId) {
        setSelectedOrderModal(prev => prev ? { ...prev, paymentStatus: status } : null);
      }
      toast.success('Status de pagamento atualizado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar status de pagamento.');
    }
  };

  const updateOrderDeliveryStatus = async (orderId: string, status: 'pending' | 'delivered') => {
    try {
      await updateDoc(doc(db, 'pedidos', orderId), {
        deliveryStatus: status
      });
      if (selectedOrderModal && selectedOrderModal.id === orderId) {
        setSelectedOrderModal(prev => prev ? { ...prev, deliveryStatus: status } : null);
      }
      toast.success(status === 'delivered' ? 'Pedido marcado como Entregue!' : 'Pedido marcado como A Entregar!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar status de entrega.');
    }
  };

  const deleteCustomer = async (customer: any) => {
    const customerId = customer.phone || customer.email || customer.name;
    const customerOrders = orders.filter(o => (o.phone || o.email || o.customerName) === customerId);
    
    try {
      setIsSaving(true);
      if (customer.id) {
        await deleteDoc(doc(db, 'clientes', customer.id));
      }
      for (const order of customerOrders) {
        await deleteDoc(doc(db, 'pedidos', order.id));
      }
      toast.success('Cliente e seus pedidos excluídos com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      toast.error('Erro ao excluir cliente');
    } finally {
      setIsSaving(false);
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
    }
  };

  const updateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const originalId = isEditingCustomer.phone || isEditingCustomer.email || isEditingCustomer.name;
    const customerOrders = orders.filter(o => {
      return o.customerName === originalId || o.phone === originalId || o.email === originalId;
    });

    try {
      setIsSaving(true);
      
      const fullAddr = `${editCustomerForm.street || ''}, ${editCustomerForm.number || 'S/N'} - ${editCustomerForm.city || ''} (${editCustomerForm.zipCode || ''})`;

      if (isEditingCustomer.id) {
        const mcDocRef = doc(db, 'clientes', isEditingCustomer.id);
        await updateDoc(mcDocRef, {
          name: editCustomerForm.name,
          phone: editCustomerForm.phone,
          email: editCustomerForm.email,
          birthday: editCustomerForm.birthday || '',
          isB2B: false,
          managerName: '',
          frequency: '',
          address: fullAddr,
          street: editCustomerForm.street || '',
          number: editCustomerForm.number || '',
          zipCode: editCustomerForm.zipCode || '',
          city: editCustomerForm.city || ''
        });
      }

      for (const order of customerOrders) {
        const updateData: any = {
          phone: editCustomerForm.phone,
          email: editCustomerForm.email,
          birthday: editCustomerForm.birthday || '',
          customerName: editCustomerForm.name,
          street: editCustomerForm.street || '',
          number: editCustomerForm.number || '',
          zipCode: editCustomerForm.zipCode || '',
          city: editCustomerForm.city || '',
          address: fullAddr
        };

        await updateDoc(doc(db, 'pedidos', order.id), updateData);
      }
      toast.success('Informações do cliente atualizadas!');
      setIsEditingCustomer(null);
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      toast.error('Erro ao atualizar cliente');
    } finally {
      setIsSaving(false);
    }
  };

  const saveNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.name) {
      toast.error('O nome do cliente é obrigatório.');
      return;
    }
    try {
      setIsSaving(true);
      const fullAddr = `${newCustomerForm.street || ''}, ${newCustomerForm.number || 'S/N'} - ${newCustomerForm.city || ''} (${newCustomerForm.zipCode || ''})`;

      const clientData = {
        name: newCustomerForm.name,
        phone: newCustomerForm.phone || '',
        email: newCustomerForm.email || '',
        birthday: newCustomerForm.birthday || '',
        isB2B: false,
        managerName: '',
        frequency: '',
        address: fullAddr,
        street: newCustomerForm.street || '',
        number: newCustomerForm.number || '',
        zipCode: newCustomerForm.zipCode || '',
        city: newCustomerForm.city || '',
        createdAt: new Date()
      };

      await addDoc(collection(db, 'clientes'), clientData);
      toast.success('Cliente cadastrado com sucesso!');
      setIsRegisteringCustomer(false);
    } catch (error) {
      console.error('Erro ao cadastrar cliente:', error);
      toast.error('Erro ao cadastrar cliente');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddManualItem = () => {
    if (!selectedManualProduct) {
      toast.error('Por favor, selecione um produto.');
      return;
    }

    let finalPrice = selectedManualProduct.price;
    let titleDetail = selectedManualProduct.title;
    let itemSize: any = null;

    if (selectedManualProduct.hasSizes && selectedManualProduct.sizes && selectedManualProduct.sizes.length > 0) {
      if (!selectedManualSize) {
        toast.error('Por favor, selecione um tamanho/variação.');
        return;
      }
      finalPrice = selectedManualSize.price;
      titleDetail = `${selectedManualProduct.title} (${selectedManualSize.name})`;
      itemSize = selectedManualSize;
    }

    const mealOpts: any = {};
    if (selectedManualProduct.isMeal) {
      mealOpts.removals = selectedManualMealRemovals;
      mealOpts.sides = selectedManualMealSides;
      if (selectedManualMealRemovals.length > 0) {
        titleDetail += ` [Sem: ${selectedManualMealRemovals.join(', ')}]`;
      }
      if (selectedManualMealSides.length > 0) {
        titleDetail += ` [Acomp: ${selectedManualMealSides.map(s => s.name).join(', ')}]`;
      }
    }

    const cakeOpts: any = {};
    if (selectedManualProduct.isCustomCake) {
      cakeOpts.size = selectedManualCakeOptions.size;
      cakeOpts.dough = selectedManualCakeOptions.dough;
      cakeOpts.fillings = selectedManualCakeOptions.fillings;
      cakeOpts.topping = selectedManualCakeOptions.topping;
      cakeOpts.topper = selectedManualCakeOptions.topper;
      cakeOpts.styleNumber = selectedManualCakeOptions.styleNumber;

      titleDetail += ` [Bolo: ${cakeOpts.size || ''}, ${cakeOpts.dough || ''}, Recheio: ${(cakeOpts.fillings || []).join(' e ')}]`;
    }

    const newItem = {
      id: Math.random().toString(36).substr(2, 9),
      productId: selectedManualProduct.id,
      title: titleDetail,
      quantity: manualProductQty,
      price: finalPrice,
      priceType: selectedManualProduct.priceType || 'fixed',
      mealOptions: selectedManualProduct.isMeal ? mealOpts : undefined,
      selectedSize: itemSize || undefined,
      cakeOptions: selectedManualProduct.isCustomCake ? cakeOpts : undefined,
    };

    setManualOrderItems([...manualOrderItems, newItem]);

    setSelectedManualProduct(null);
    setManualProductQty(1);
    setSelectedManualSize(null);
    setSelectedManualMealRemovals([]);
    setSelectedManualMealSides([]);
    setSelectedManualCakeOptions({
      size: '',
      dough: '',
      fillings: [],
      topping: '',
      topper: '',
      styleNumber: 1
    });
    toast.success('Item adicionado ao pedido!');
  };

  const handleCreateManualOrder = async () => {
    if (manualOrderItems.length === 0) {
      toast.error('Adicione pelo menos um item ao pedido.');
      return;
    }
    if (!manualOrderForm.customerName) {
      toast.error('O nome do cliente é obrigatório.');
      return;
    }

    try {
      setIsSaving(true);
      const total = manualOrderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

      const fullAddr = manualOrderForm.deliveryOption === 'pickup'
        ? 'Retirada no Local'
        : (manualOrderForm.street
            ? `${manualOrderForm.street}${manualOrderForm.number ? ', nº ' + manualOrderForm.number : ''}${manualOrderForm.city ? ' - ' + manualOrderForm.city : ''}${manualOrderForm.zipCode ? ' (' + manualOrderForm.zipCode + ')' : ''}`
            : (manualOrderForm.address || ''));

      const orderData = {
        customerName: manualOrderForm.customerName,
        phone: manualOrderForm.phone || '',
        email: manualOrderForm.email || '',
        address: fullAddr,
        street: manualOrderForm.street || '',
        number: manualOrderForm.number || '',
        zipCode: manualOrderForm.zipCode || '',
        city: manualOrderForm.city || '',
        deliveryOption: manualOrderForm.deliveryOption || 'delivery',
        birthday: manualOrderForm.birthday || '',
        pickupDate: manualOrderForm.pickupDate || '',
        observation: manualOrderForm.observation || '',
        items: manualOrderItems.map(item => ({
          title: item.title,
          quantity: item.quantity,
          price: item.price,
          priceType: item.priceType || 'fixed',
          mealOptions: item.mealOptions || null,
          selectedSize: item.selectedSize || null,
          cakeOptions: item.cakeOptions || null
        })),
        total: total,
        subtotal: total,
        createdAt: new Date(),
        orderLanguage: settings?.language || 'pt'
      };

      await addDoc(collection(db, 'pedidos'), orderData);
      toast.success('Pedido manual cadastrado com sucesso!');
      setIsAddingOrder(false);
      setManualOrderItems([]);
      setManualOrderForm({
        customerName: '',
        phone: '',
        email: '',
        address: '',
        street: '',
        number: '',
        zipCode: '',
        city: '',
        pickupDate: '',
        deliveryOption: 'delivery',
        observation: '',
        birthday: ''
      });
    } catch (error) {
      console.error('Erro ao cadastrar pedido manual:', error);
      toast.error('Erro ao cadastrar pedido manual');
    } finally {
      setIsSaving(false);
    }
  };

  const closestUpcomingOrder = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parseDateString = (str: string, lang?: string) => {
      if (!str || !str.includes('/')) return null;
      const parts = str.split('/');
      if (parts.length !== 3) return null;
      
      let month = parseInt(parts[0]);
      let day = parseInt(parts[1]);
      let year = parseInt(parts[2]);

      // Always treat as MM/DD/YYYY by default (USA pattern), but if the first part (month) is > 12, it is definitely DD/MM/YYYY
      if (month > 12) {
        day = parseInt(parts[0]);
        month = parseInt(parts[1]);
      }
      
      if (!day || !month || !year || month > 12) return null;
      return new Date(year, month - 1, day);
    };

    const upcomingOrders = orders
      .map(o => {
        if (!o.pickupDate) return null;
        const d = parseDateString(o.pickupDate, o.orderLanguage || settings.language || 'pt');
        if (!d) return null;
        d.setHours(0, 0, 0, 0);
        return { order: o, date: d };
      })
      .filter((item): item is { order: Order; date: Date } => item !== null && item.date >= today);

    if (upcomingOrders.length === 0) {
      // If none are in the future, get the closest one overall that has a pickupDate
      const allWithDate = orders
        .map(o => {
          if (!o.pickupDate) return null;
          const d = parseDateString(o.pickupDate, o.orderLanguage || settings.language || 'pt');
          if (!d) return null;
          d.setHours(0, 0, 0, 0);
          return { order: o, date: d };
        })
        .filter((item): item is { order: Order; date: Date } => item !== null);
      
      if (allWithDate.length === 0) return null;
      
      allWithDate.sort((a, b) => b.date.getTime() - a.date.getTime());
      return allWithDate[0].order;
    }

    upcomingOrders.sort((a, b) => a.date.getTime() - b.date.getTime());
    return upcomingOrders[0].order;
  }, [orders, settings.language]);

  const triggerPrintWorkflow = (htmlContent: string, title: string, textVersion: string, order?: Order) => {
    setActivePrintReceipt({
      title,
      htmlContent,
      textVersion,
      order
    });

    try {
      let container = document.getElementById('printable-receipt-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'printable-receipt-container';
        document.body.appendChild(container);
      }
      container.innerHTML = htmlContent;

      let iframe = document.getElementById('print-iframe') as HTMLIFrameElement;
      if (iframe && iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }

      iframe = document.createElement('iframe');
      iframe.id = 'print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.left = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '10px';
      iframe.style.height = '10px';
      iframe.style.opacity = '0.01';
      iframe.style.border = '0';
      iframe.style.pointerEvents = 'none';
      iframe.style.zIndex = '-9999';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>@page{size:80mm auto;margin:2mm;}body{font-family:'Courier New',Courier,monospace,sans-serif;width:74mm;margin:0 auto;padding:2mm 1mm;font-size:12px;color:#000;line-height:1.35;}@media print{body{width:74mm;padding:0;}}</style></head><body>${htmlContent}</body></html>`);
        iframeDoc.close();
      }

      setTimeout(() => {
        try {
          if (iframe.contentWindow) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          } else {
            window.print();
          }
        } catch (err) {
          console.warn('Iframe print blocked, falling back to window.print:', err);
          try {
            window.print();
          } catch (e) {
            console.error('Print fallback error:', e);
          }
        }
      }, 350);
    } catch (e) {
      console.error('Erro em triggerPrintWorkflow:', e);
    }
  };

  const printOrdersList = () => {
    try {
      toast.info('Preparando impressão da lista de pedidos...', { duration: 2000 });
      const listTitle = orderTypeTab === 'b2b' 
        ? 'PEDIDOS CORPORATIVOS (B2B)' 
        : 'PEDIDOS DO VAREJO';

      let textVersion = `========================================\n${settings?.brandName || 'Escola de gastronomia e negócios'}\n${listTitle}\nData: ${new Date().toLocaleString('pt-BR')}\nTotal de Pedidos: ${filteredOrders.length}\n========================================\n\n`;

      const contentHtml = filteredOrders.map((order, index) => {
        const items = Array.isArray(order.items) ? order.items : [];
        const itemsText = items.map(item => `  ${item.quantity || 1}x ${item.title || 'Item'}${item.selectedSize ? ` (${item.selectedSize.name})` : ''}`).join('\n');
        const name = (order.isB2B || order.isPJ ? (order.b2bCompanyName || order.customerName) : order.customerName) || 'Cliente';
        const scheduled = getOrderScheduledInfo(order);
        const deliveryDate = scheduled.dateDisplay || order.pickupDate || 'N/A';
        const modalityStr = scheduled.isDelivery ? 'Entrega' : 'Retirada';
        
        textVersion += `#${index + 1} - ${name.toUpperCase()}\nTEL: ${order.phone ? formatBRPhone(order.phone) : 'N/A'}\nAGENDAMENTO: ${deliveryDate} (${modalityStr} - ${scheduled.timeStr || '18:00'})\nSTATUS: ${order.paymentStatus === 'full' ? 'PAGO INTEGRAL' : order.paymentStatus === 'half' ? '50% PAGO' : 'PAGAMENTO PENDENTE'}\nITENS:\n${itemsText || '  Nenhum item'}\nTOTAL: ${currencySymbol} ${Number(order.total || 0).toFixed(2).replace('.', ',')}\n----------------------------------------\n`;

        return `
          <div style="border-bottom: 1px dashed #777; padding: 6px 0; margin-bottom: 6px;">
            <div style="font-weight: 900; font-size: 12px;">#${index + 1} - ${name.toUpperCase()}</div>
            <div style="font-size: 10px; color: #333; margin-top: 2px;">
              TEL: ${order.phone ? formatBRPhone(order.phone) : 'N/A'}<br/>
              AGENDAMENTO: ${deliveryDate} (${modalityStr} - ${scheduled.timeStr || '18:00'})<br/>
              STATUS: ${order.paymentStatus === 'full' ? '✅ PAGO INTEGRAL' : order.paymentStatus === 'half' ? '⏳ 50% PAGO' : '❌ PENDENTE'}
            </div>
            <div style="font-size: 11px; margin-top: 4px; white-space: pre-wrap;">${itemsText || '  Nenhum item'}</div>
            <div style="font-weight: 900; font-size: 11px; text-align: right; margin-top: 3px;">TOTAL: ${currencySymbol} ${Number(order.total || 0).toFixed(2).replace('.', ',')}</div>
          </div>
        `;
      }).join('');

      const totalSum = filteredOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      textVersion += `\nSOMA TOTAL: ${currencySymbol} ${totalSum.toFixed(2).replace('.', ',')}\n========================================`;

      const htmlContent = `
        <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 8px;">
          <h2 style="margin: 0; font-size: 14px; font-weight: 900; text-transform: uppercase;">${settings?.brandName || 'Escola de gastronomia e negócios'}</h2>
          <p style="margin: 3px 0 0 0; font-size: 11px; font-weight: bold;">${listTitle}</p>
          <p style="margin: 2px 0 0 0; font-size: 10px; color: #555;">Gerado em: ${new Date().toLocaleString('pt-BR')} • Total: ${filteredOrders.length} pedidos</p>
        </div>
        ${contentHtml || '<div style="text-align: center; padding: 15px; color: #666;">Nenhum pedido encontrado.</div>'}
        <div style="font-size: 14px; font-weight: 900; text-align: right; border-top: 2px solid #000; padding-top: 6px; margin-top: 8px;">
          SOMA TOTAL: ${currencySymbol} ${totalSum.toFixed(2).replace('.', ',')}
        </div>
      `;

      triggerPrintWorkflow(htmlContent, listTitle, textVersion);
    } catch (e) {
      console.error('Erro ao imprimir lista de pedidos:', e);
      toast.error('Erro ao preparar lista para impressão.');
    }
  };

  const printAllProductsList = () => {
    try {
      toast.info('Preparando impressão do cardápio...', { duration: 2000 });
      const groupedProducts = categories.map(cat => {
        const catProducts = products.filter(p => p.categoryId === cat.id);
        return {
          categoryTitle: cat.title,
          products: catProducts
        };
      }).filter(group => group.products.length > 0);

      const uncategorizedProducts = products.filter(p => !p.categoryId || !categories.some(cat => cat.id === p.categoryId));
      if (uncategorizedProducts.length > 0) {
        groupedProducts.push({
          categoryTitle: 'Sem Categoria',
          products: uncategorizedProducts
        });
      }

      let textVersion = `========================================\n${settings?.brandName || 'Escola de gastronomia e negócios'}\nRELATÓRIO DE PRODUTOS DO CARDÁPIO\nGerado em: ${new Date().toLocaleString('pt-BR')}\nTotal de Produtos: ${products.length}\n========================================\n\n`;

      const contentHtml = groupedProducts.map(group => {
        textVersion += `[${group.categoryTitle.toUpperCase()}]\n`;
        const productsHtml = group.products.map((product, idx) => {
          let priceStr = '';
          if (product.hasSizes && product.sizes && product.sizes.length > 0) {
            priceStr = product.sizes.map(s => `  - ${s.name}: ${currencySymbol} ${Number(s.price).toFixed(2).replace('.', ',')}`).join('\n');
          } else {
            priceStr = `  ${currencySymbol} ${Number(product.price || 0).toFixed(2).replace('.', ',')}`;
            if (product.oldPrice) {
              priceStr += ` (De: ${currencySymbol} ${Number(product.oldPrice).toFixed(2).replace('.', ',')})`;
            }
          }

          let catalogLabel = '';
          if (product.catalog === 'catalog1') {
            catalogLabel = settings?.catalog1Title || 'Catálogo 1';
          } else if (product.catalog === 'catalog2') {
            catalogLabel = settings?.catalog2Title || 'Catálogo 2';
          } else if (product.catalog === 'catalog3') {
            catalogLabel = settings?.catalog3Title || 'Catálogo 3';
          } else if (product.catalog === 'catalog4') {
            catalogLabel = settings?.catalog4Title || 'Catálogo 4';
          } else if (product.catalog === 'all') {
            catalogLabel = 'Todos';
          }

          const activeStatusText = product.isActive !== false ? 'ATIVO' : 'INATIVO';
          textVersion += `${idx + 1}. ${product.title.toUpperCase()} [${activeStatusText}]\n${priceStr}\n\n`;

          return `
            <div style="margin-bottom: 8px; border-bottom: 1px dashed #ccc; padding-bottom: 4px;">
              <div style="font-weight: bold; font-size: 11px;">${idx + 1}. ${product.title.toUpperCase()} [${activeStatusText}]</div>
              ${product.description ? `<div style="font-size: 10px; color: #444; margin: 2px 0;">${product.description}</div>` : ''}
              ${catalogLabel ? `<div style="font-size: 10px; font-style: italic;">Catálogo: ${catalogLabel}</div>` : ''}
              <div style="font-weight: bold; font-size: 11px; white-space: pre-wrap; margin-top: 2px;">${priceStr}</div>
            </div>
          `;
        }).join('');

        return `
          <div style="margin-top: 10px;">
            <div style="font-weight: bold; font-size: 11px; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 5px; text-transform: uppercase;">${group.categoryTitle.toUpperCase()}</div>
            ${productsHtml}
          </div>
        `;
      }).join('');

      const htmlContent = `
        <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 8px;">
          <h2 style="margin: 0; font-size: 14px; font-weight: 900; text-transform: uppercase;">${settings?.brandName || 'Escola de gastronomia e negócios'}</h2>
          <p style="margin: 3px 0 0 0; font-size: 11px; font-weight: bold;">Relatório de Produtos do Cardápio</p>
          <p style="margin: 2px 0 0 0; font-size: 10px; color: #555;">Gerado em: ${new Date().toLocaleString('pt-BR')} • Total: ${products.length} produtos</p>
        </div>
        ${contentHtml || '<div style="text-align: center; padding: 15px; color: #666;">Nenhum produto cadastrado.</div>'}
      `;

      triggerPrintWorkflow(htmlContent, 'Cardápio Completo', textVersion);
    } catch (e) {
      console.error('Erro ao imprimir cardápio:', e);
      toast.error('Erro ao preparar cardápio para impressão.');
    }
  };

  const printProductionSummary = () => {
    try {
      toast.info('Preparando impressão do resumo de produção...', { duration: 2000 });
      const listTitle = orderTypeTab === 'b2b'
        ? 'RESUMO PRODUÇÃO - B2B'
        : 'RESUMO PRODUÇÃO - VAREJO';

      const itemsHtml = Object.entries(batchSummary.items).map(([title, qty]) => `
        <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dashed #ccc; font-size: 11px;">
          <span style="max-width: 80%;">${title}</span>
          <span style="font-weight: bold; font-size: 12px;">${qty}x</span>
        </div>
      `).join('');

      const sidesHtml = Object.entries(batchSummary.sides).map(([name, qty]) => `
        <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dashed #ccc; font-size: 11px;">
          <span style="max-width: 80%;">${name}</span>
          <span style="font-weight: bold; font-size: 12px;">${qty}x</span>
        </div>
      `).join('');

      const dateRangeText = (startDate || endDate) 
        ? `Período: ${startDate || 'Início'} até ${endDate || 'Fim'}`
        : 'Todos os Pedidos';

      let textVersion = `========================================\n${listTitle}\n${dateRangeText}\nGerado em: ${new Date().toLocaleString('pt-BR')}\n========================================\n\n[TOTAL DE ITENS]\n`;
      Object.entries(batchSummary.items).forEach(([title, qty]) => {
        textVersion += `${title}: ${qty}x\n`;
      });
      textVersion += `\n[ACOMPANHAMENTOS]\n`;
      Object.entries(batchSummary.sides).forEach(([name, qty]) => {
        textVersion += `${name}: ${qty}x\n`;
      });
      textVersion += `========================================\n`;

      const htmlContent = `
        <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 8px;">
          <h2 style="margin: 0; font-size: 14px; font-weight: 900; text-transform: uppercase;">${listTitle}</h2>
          <p style="margin: 3px 0 0 0; font-size: 11px; font-weight: bold;">${dateRangeText}</p>
          <p style="margin: 2px 0 0 0; font-size: 10px; color: #555;">Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
        </div>
        
        <div style="margin-bottom: 12px;">
          <div style="font-weight: bold; font-size: 11px; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 5px; text-transform: uppercase;">📦 TOTAL DE ITENS</div>
          <div>
            ${itemsHtml || '<div style="text-align: center; padding: 5px; color: #666;">Nenhum item no período.</div>'}
          </div>
        </div>

        <div style="margin-bottom: 12px;">
          <div style="font-weight: bold; font-size: 11px; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 5px; text-transform: uppercase;">➕ ACOMPANHAMENTOS</div>
          <div>
            ${sidesHtml || '<div style="text-align: center; padding: 5px; color: #666;">Nenhum acompanhamento.</div>'}
          </div>
        </div>
      `;

      triggerPrintWorkflow(htmlContent, listTitle, textVersion);
    } catch (e) {
      console.error('Erro ao imprimir resumo de produção:', e);
      toast.error('Erro ao preparar resumo de produção.');
    }
  };

  const handleEditOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditingOrder) return;
    try {
      await updateDoc(doc(db, 'pedidos', isEditingOrder.id), editOrderForm);
      setIsEditingOrder(null);
    } catch (err) {
      alert('Erro ao atualizar pedido.');
    }
  };

  const toggleOrder = (orderId: string) => {
    setExpandedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId) 
        : [...prev, orderId]
    );
  };

  const copyLink = () => {
    const url = `${window.location.origin}/?slug=${settings?.slug || 'cardapio'}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const printOrder = (order: Order) => {
    try {
      toast.info('Preparando comanda de impressão...', { duration: 2000 });
      const dateStr = formatOrderFullDate(order.createdAt);
      const isCorp = !!(order.isB2B || order.isPJ);
      const customerName = (isCorp ? (order.b2bCompanyName || order.customerName) : order.customerName) || 'Cliente';
      const phoneFormatted = order.phone ? formatBRPhone(order.phone) : 'Não informado';
      const addressFormatted = (isCorp ? (order.b2bAddress || order.address) : order.address) || 'Não informado';
      const scheduledInfo = getOrderScheduledInfo(order);

      const items = Array.isArray(order.items) ? order.items : [];
      let textItemsVersion = '';
      let itemsHtml = items.map(item => {
        let optionsHtml = '';
        let optionsText = '';
        if (item.cakeOptions && (item.cakeOptions.size || item.cakeOptions.dough || item.cakeOptions.fillings)) {
          optionsHtml = `
            <div style="font-size: 10px; color: #333; padding-left: 6px; margin-top: 2px; line-height: 1.25;">
              ${item.cakeOptions.size ? `<div>TAMANHO: ${item.cakeOptions.size}</div>` : ''}
              ${item.cakeOptions.dough ? `<div>MASSA: ${item.cakeOptions.dough}</div>` : ''}
              ${item.cakeOptions.fillings && item.cakeOptions.fillings.length > 0 ? `<div>RECHEIOS: ${item.cakeOptions.fillings.join(', ')}</div>` : ''}
              ${item.cakeOptions.topping ? `<div>COBERTURA: ${item.cakeOptions.topping}</div>` : ''}
              ${item.cakeOptions.topper ? `<div>TOPO: ${item.cakeOptions.topper}</div>` : ''}
            </div>
          `;
          if (item.cakeOptions.size) optionsText += `  - TAMANHO: ${item.cakeOptions.size}\n`;
          if (item.cakeOptions.dough) optionsText += `  - MASSA: ${item.cakeOptions.dough}\n`;
          if (item.cakeOptions.fillings && item.cakeOptions.fillings.length > 0) optionsText += `  - RECHEIOS: ${item.cakeOptions.fillings.join(', ')}\n`;
          if (item.cakeOptions.topping) optionsText += `  - COBERTURA: ${item.cakeOptions.topping}\n`;
          if (item.cakeOptions.topper) optionsText += `  - TOPO: ${item.cakeOptions.topper}\n`;
        } else if (item.sandwichOptions && item.sandwichOptions.fillings && item.sandwichOptions.fillings.length > 0) {
          optionsHtml = `
            <div style="font-size: 10px; color: #333; padding-left: 6px; margin-top: 2px; line-height: 1.25;">
              <div>RECHEIOS: ${item.sandwichOptions.fillings.join(', ')}</div>
            </div>
          `;
          optionsText += `  - RECHEIOS: ${item.sandwichOptions.fillings.join(', ')}\n`;
        } else if (item.mealOptions) {
          optionsHtml = `
            <div style="font-size: 10px; color: #333; padding-left: 6px; margin-top: 2px; line-height: 1.25;">
              ${item.mealOptions.removals && item.mealOptions.removals.length > 0 ? `<div>REMOVER: ${item.mealOptions.removals.join(', ')}</div>` : ''}
              ${item.mealOptions.sides && item.mealOptions.sides.length > 0 ? `<div>ACOMPANHAMENTOS: ${item.mealOptions.sides.map((s: any) => s.name).join(', ')}</div>` : ''}
            </div>
          `;
          if (item.mealOptions.removals && item.mealOptions.removals.length > 0) optionsText += `  - REMOVER: ${item.mealOptions.removals.join(', ')}\n`;
          if (item.mealOptions.sides && item.mealOptions.sides.length > 0) optionsText += `  - ACOMPANHAMENTOS: ${item.mealOptions.sides.map((s: any) => s.name).join(', ')}\n`;
        }

        const itemTotal = (Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2).replace('.', ',');
        const sizeStr = item.selectedSize?.name ? ` (${String(item.selectedSize.name).toUpperCase()})` : '';

        textItemsVersion += `${item.quantity || 1}x ${String(item.title || 'Item').toUpperCase()}${sizeStr} - ${currencySymbol} ${itemTotal}\n${optionsText}${item.notes ? `  Obs: ${item.notes}\n` : ''}`;

        return `
          <div style="border-bottom: 1px dashed #777; padding: 5px 0; font-size: 11px;">
            <div style="display: flex; justify-content: space-between; font-weight: bold; gap: 4px;">
              <span>${item.quantity || 1}x ${String(item.title || 'Item').toUpperCase()}${sizeStr}</span>
              <span>${currencySymbol} ${itemTotal}</span>
            </div>
            ${optionsHtml}
            ${item.notes ? `<div style="font-size: 10px; font-style: italic; color: #555; padding-left: 6px; margin-top: 2px;">Obs: ${item.notes}</div>` : ''}
          </div>
        `;
      }).join('');

      const paymentStatusLabel = 
        order.paymentStatus === 'full' ? '✅ 100% PAGO (INTEGRAL)' :
        order.paymentStatus === 'half' ? '⏳ 50% SINAL PAGO' :
        '❌ PAGAMENTO PENDENTE';

      const deliveryStatusLabel = 
        order.deliveryStatus === 'delivered' ? '✓ ENTREGUE' : '⏳ A ENTREGAR';

      const orderTotalStr = Number(order.total || 0).toFixed(2).replace('.', ',');

      const plainTextVersion = `========================================
${settings?.brandName || 'Escola de gastronomia e negócios'}
*** COMANDA DE PEDIDO ***
========================================
EMITIDO EM: ${new Date().toLocaleString('pt-BR')}
PEDIDO ID: #${order.id}
DATA CRIACAO: ${dateStr}

CLIENTE: ${customerName.toUpperCase()}
TELEFONE: ${phoneFormatted}
${order.email ? `EMAIL: ${order.email}\n` : ''}
AGENDAMENTO: ${scheduledInfo.dateDisplay || 'Data não definida'} (${scheduledInfo.isDelivery ? 'ENTREGA' : 'RETIRADA'} - ${scheduledInfo.timeStr || '18:00'})
ENDEREÇO: ${addressFormatted.toUpperCase()}
${order.deliveryNeighborhood ? `BAIRRO DE ENTREGA: ${order.deliveryNeighborhood.toUpperCase()}\nTAXA DE ENTREGA: ${order.deliveryFee ? `${currencySymbol} ${order.deliveryFee.toFixed(2).replace('.', ',')}` : 'A COMBINAR'}\n` : ''}
STATUS PGTO: ${paymentStatusLabel}
STATUS ENTREGA: ${deliveryStatusLabel}
${order.birthday ? `ANIVERSÁRIO: ${order.birthday}\n` : ''}
----------------------------------------
ITENS DO PEDIDO:
----------------------------------------
${textItemsVersion || 'Nenhum item listado\n'}
${order.observation ? `----------------------------------------\nOBSERVAÇÕES:\n${String(order.observation).toUpperCase()}\n` : ''}----------------------------------------
TOTAL: ${currencySymbol} ${orderTotalStr}
========================================
`;

      const htmlContent = `
        <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 8px;">
          <h2 style="margin: 0; font-size: 14px; font-weight: 900; text-transform: uppercase;">${settings?.brandName || 'Escola de gastronomia e negócios'}</h2>
          <p style="margin: 3px 0 0 0; font-size: 10px; font-weight: bold;">*** COMANDA DE PEDIDO ***</p>
          <p style="margin: 2px 0 0 0; font-size: 9px; color: #444;">Emitido em: ${new Date().toLocaleString('pt-BR')}</p>
        </div>
        
        <div style="margin-bottom: 5px;">
          <span style="font-weight: bold; font-size: 9px; text-transform: uppercase; color: #444; display: block;">CLIENTE:</span>
          <div style="font-size: 12px; font-weight: 900; margin-top: 1px; word-break: break-word;">${customerName.toUpperCase()}</div>
        </div>
        
        <div style="margin-bottom: 5px;">
          <span style="font-weight: bold; font-size: 9px; text-transform: uppercase; color: #444; display: block;">TELEFONE:</span>
          <div style="font-size: 11px; font-weight: bold; margin-top: 1px;">${phoneFormatted}</div>
        </div>
        
        ${order.email ? `
        <div style="margin-bottom: 5px;">
          <span style="font-weight: bold; font-size: 9px; text-transform: uppercase; color: #444; display: block;">E-MAIL:</span>
          <div style="font-size: 10px;">${order.email}</div>
        </div>
        ` : ''}

        <div style="margin-bottom: 5px;">
          <span style="font-weight: bold; font-size: 9px; text-transform: uppercase; color: #444; display: block;">AGENDAMENTO / MODALIDADE:</span>
          <div style="font-size: 11px; font-weight: bold;">📅 ${scheduledInfo.dateDisplay || 'Data não definida'}</div>
          <div style="font-size: 11px; font-weight: bold;">🕒 ${scheduledInfo.isDelivery ? 'ENTREGA EM DOMICÍLIO' : 'RETIRADA NO BALCÃO'} (${scheduledInfo.timeStr || '18:00'})</div>
        </div>

        <div style="margin-bottom: 5px;">
          <span style="font-weight: bold; font-size: 9px; text-transform: uppercase; color: #444; display: block;">ENDEREÇO DE ENTREGA / RETIRADA:</span>
          <div style="font-size: 11px; font-weight: bold;">${addressFormatted.toUpperCase()}</div>
        </div>

        ${order.deliveryNeighborhood ? `
        <div style="margin-bottom: 5px;">
          <span style="font-weight: bold; font-size: 9px; text-transform: uppercase; color: #444; display: block;">BAIRRO E TAXA DE ENTREGA:</span>
          <div style="font-size: 11px; font-weight: bold; color: #000;">📍 ${order.deliveryNeighborhood.toUpperCase()} (TAXA: ${order.deliveryFee ? `${currencySymbol} ${order.deliveryFee.toFixed(2).replace('.', ',')}` : 'A COMBINAR'})</div>
        </div>
        ` : ''}
        
        <div style="margin-bottom: 6px;">
          <span style="font-weight: bold; font-size: 9px; text-transform: uppercase; color: #444; display: block;">STATUS:</span>
          <div style="display: inline-block; padding: 2px 5px; border: 1px solid #000; font-size: 9px; font-weight: 900; text-transform: uppercase; margin-top: 2px; margin-right: 4px;">${paymentStatusLabel}</div>
          <div style="display: inline-block; padding: 2px 5px; border: 1px solid #000; font-size: 9px; font-weight: 900; text-transform: uppercase; margin-top: 2px;">${deliveryStatusLabel}</div>
        </div>

        ${order.birthday ? `
        <div style="margin-bottom: 5px;">
          <span style="font-weight: bold; font-size: 9px; text-transform: uppercase; color: #444; display: block;">ANIVERSÁRIO:</span>
          <div style="font-size: 11px; font-weight: bold;">${order.birthday}</div>
        </div>
        ` : ''}
        
        <div style="border-top: 1px solid #000; margin: 6px 0;"></div>
        
        <div style="margin-bottom: 6px;">
          <div style="font-weight: 900; font-size: 10px; text-transform: uppercase; margin-bottom: 4px;">ITENS DO PEDIDO:</div>
          ${itemsHtml || '<div style="text-align: center; padding: 4px;">Nenhum item listado</div>'}
        </div>
        
        ${order.observation ? `
        <div style="border-top: 1px solid #000; margin: 6px 0;"></div>
        <div style="margin-bottom: 6px;">
          <div style="font-weight: 900; font-size: 9px; text-transform: uppercase;">OBSERVAÇÕES:</div>
          <div style="font-style: italic; font-size: 11px;">${String(order.observation).toUpperCase()}</div>
        </div>
        ` : ''}
        
        <div style="border-top: 1px solid #000; margin: 6px 0;"></div>
        <div style="opacity: 0.85; font-size: 9px;">
          ID DO PEDIDO: ${order.id}<br/>
          CRIADO EM: ${dateStr}
        </div>
        
        ${(order.taxAmount && order.taxAmount > 0) ? `
        <div style="text-align: right; font-size: 10px; margin-top: 6px;">
          <div>SUBTOTAL: ${currencySymbol} ${(order.subtotal || (order.total - order.taxAmount)).toFixed(2).replace('.', ',')}</div>
          <div style="margin-top: 2px;">TAX (${order.taxRate || 8.25}%): + ${currencySymbol} ${order.taxAmount.toFixed(2).replace('.', ',')}</div>
        </div>
        ` : ''}
        
        <div style="text-align: right; font-weight: 900; font-size: 14px; margin-top: 6px; text-transform: uppercase; border-top: 2px solid #000; padding-top: 4px;">
          TOTAL: ${currencySymbol} ${orderTotalStr}
        </div>
        <div style="text-align: center; font-size: 9px; margin-top: 10px; border-top: 1px dotted #ccc; padding-top: 4px;">
          Obrigado pela preferência!
        </div>
      `;

      triggerPrintWorkflow(htmlContent, `Comanda - ${customerName}`, plainTextVersion, order);
    } catch (error) {
      console.error('Erro ao imprimir comanda:', error);
      toast.error('Erro ao gerar comanda para impressão.');
    }
  };

  const isBirthdayThisWeek = (birthdayStr: string, orderLanguage?: string) => {
    if (!birthdayStr) return false;
    
    const cleaned = birthdayStr.trim().replace(/[\s\.-]+/g, '/');
    const parts = cleaned.split('/');
    if (parts.length < 2) return false;
    
    let p0 = parseInt(parts[0]);
    let p1 = parseInt(parts[1]);
    
    if (isNaN(p0) || isNaN(p1)) return false;
    
    let day = p0;
    let month = p1 - 1; // 0-indexed month
    
    if (p0 <= 12 && p1 > 12) {
      day = p1;
      month = p0 - 1;
    } else {
      day = p0;
      month = p1 - 1;
    }
    
    if (month < 0 || month > 11 || day < 1 || day > 31) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear();
    
    const checkDates = [
      new Date(currentYear - 1, month, day),
      new Date(currentYear, month, day),
      new Date(currentYear + 1, month, day)
    ];
    
    return checkDates.some(bday => {
      const diffTime = bday.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= -3 && diffDays <= 7;
    });
  };

  const orderBelongsToCatalog = (order: Order, catalogId: 'catalog1' | 'catalog2' | 'catalog3' | 'catalog4') => {
    if (!order.items || order.items.length === 0) return true;
    if ((order as any).catalog && (order as any).catalog === catalogId) return true;

    return order.items.some(item => {
      if ((item as any).catalog) {
        const itemCat = (item as any).catalog;
        if (itemCat === catalogId || itemCat === 'both' || itemCat === 'all') return true;
      }

      const prod = products.find(p => 
        (item.productId && p.id === item.productId) || 
        p.title?.trim().toLowerCase() === item.title?.trim().toLowerCase()
      );

      if (prod) {
        if (prod.catalog) {
          if (prod.catalog === catalogId || prod.catalog === 'all' || prod.catalog === 'both') return true;
        }
        const catObj = categories.find(c => c.id === prod.categoryId);
        if (catObj && catObj.catalog) {
          if (catObj.catalog === catalogId || catObj.catalog === 'all' || catObj.catalog === 'both') return true;
        }
        // If default catalog1 and no conflicting catalog set, match
        if (catalogId === 'catalog1') {
          return (!prod.catalog || prod.catalog === 'catalog1' || prod.catalog === 'all') && 
                 (!catObj?.catalog || catObj?.catalog === 'catalog1' || catObj?.catalog === 'all');
        }
      } else {
        // Fallback for default catalog1
        if (catalogId === 'catalog1') return true;
      }
      return false;
    });
  };

  const filteredProducts = useMemo(() => {
    const query = productSearch.toLowerCase().trim();
    if (!query) return products;
    return products.filter(product => 
      product.title.toLowerCase().includes(query) || 
      (product.description || '').toLowerCase().includes(query)
    );
  }, [products, productSearch]);

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.customerName.toLowerCase().includes(orderSearch.toLowerCase());
    
    const parseDateString = (str: string, lang?: string) => {
      if (!str || !str.includes('/')) return null;
      const parts = str.split('/');
      if (parts.length !== 3) return null;
      
      let month = parseInt(parts[0]);
      let day = parseInt(parts[1]);
      let year = parseInt(parts[2]);

      // Always treat as MM/DD/YYYY by default (USA pattern), but if the first part (month) is > 12, it is definitely DD/MM/YYYY
      if (month > 12) {
        day = parseInt(parts[0]);
        month = parseInt(parts[1]);
      }
      
      if (!day || !month || !year || month > 12) return null;
      const d = new Date(year, month - 1, day);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    let matchesDate = true;
    if (startDate || endDate) {
      // Try to use pickupDate first if available, otherwise use createdAt
      let orderDate: Date | null = null;
      if (order.pickupDate) {
        orderDate = parseDateString(order.pickupDate, order.orderLanguage || settings.language || 'pt');
      }
      
      if (!orderDate && order.createdAt?.toDate) {
        orderDate = order.createdAt.toDate();
        orderDate.setHours(0, 0, 0, 0);
      }

      if (orderDate) {
        if (startDate && startDate.length === 10) {
          const start = parseDateString(startDate, settings.language || 'pt');
          if (start && orderDate < start) matchesDate = false;
        }
        if (endDate && endDate.length === 10) {
          const end = parseDateString(endDate, settings.language || 'pt');
          if (end && orderDate > end) matchesDate = false;
        }
      } else {
        matchesDate = false;
      }
    }
    
    const isB2bOrder = order.isB2B === true || order.isPJ === true;
    const matchesTab = orderTypeTab === 'b2b' ? isB2bOrder : !isB2bOrder;
    
    let matchesCatalog = true;
    if (selectedHistoryCatalog !== 'all') {
      matchesCatalog = orderBelongsToCatalog(order, selectedHistoryCatalog);
    }

    let matchesValidated = true;
    if (filterValidatedOnly) {
      matchesValidated = order.paymentStatus === 'half' || order.paymentStatus === 'full';
    }
    
    return matchesSearch && matchesDate && matchesTab && matchesCatalog && matchesValidated;
  }).sort((a, b) => {
    const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
    const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
    return timeB - timeA;
  });

  const batchSummary = useMemo(() => {
    const summary: { [key: string]: number } = {};
    const sidesSummary: { [key: string]: number } = {};

    filteredOrders.forEach(order => {
      order.items?.forEach(item => {
        const key = item.title;
        summary[key] = (summary[key] || 0) + item.quantity;

        if (item.mealOptions?.sides) {
          item.mealOptions.sides.forEach(side => {
            sidesSummary[side.name] = (sidesSummary[side.name] || 0) + item.quantity;
          });
        }
      });
    });

    return { items: summary, sides: sidesSummary };
  }, [filteredOrders]);

  // Week & Month Calendar Computations
  const startOfWeek = useMemo(() => {
    const d = new Date(calendarDate);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }, [calendarDate]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      day.setHours(0, 0, 0, 0);
      return day;
    });
  }, [startOfWeek]);

  const monthDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false
      });
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }
    
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }
    
    return days;
  }, [calendarDate]);

  const isSameCalendarDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();
  };

  const isTodayCalendarDay = (d: Date) => {
    return isSameCalendarDay(d, new Date());
  };

  const getOrdersForDay = (day: Date) => {
    return orders.filter(order => {
      if (orderSearch.trim()) {
        const q = orderSearch.toLowerCase();
        const matchesQuery = (order.customerName || '').toLowerCase().includes(q) ||
          (order.b2bCompanyName || '').toLowerCase().includes(q) ||
          (order.phone || '').includes(q);
        if (!matchesQuery) return false;
      }
      const info = getOrderScheduledInfo(order);
      if (!info.date) return false;
      return isSameCalendarDay(info.date, day);
    });
  };

  const weekOrdersCount = useMemo(() => {
    let count = 0;
    weekDays.forEach(day => {
      count += getOrdersForDay(day).length;
    });
    return count;
  }, [weekDays, orders, orderSearch]);

  const monthOrdersCount = useMemo(() => {
    let count = 0;
    monthDays.filter(d => d.isCurrentMonth).forEach(d => {
      count += getOrdersForDay(d.date).length;
    });
    return count;
  }, [monthDays, orders, orderSearch]);

  // Financial Preset Helpers
  const setPresetThisMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setFinanceStartDate(firstDay.toISOString().split('T')[0]);
    setFinanceEndDate(lastDay.toISOString().split('T')[0]);
  };

  const setPresetLastMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    setFinanceStartDate(firstDay.toISOString().split('T')[0]);
    setFinanceEndDate(lastDay.toISOString().split('T')[0]);
  };

  const setPresetLast30Days = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29);
    setFinanceStartDate(start.toISOString().split('T')[0]);
    setFinanceEndDate(end.toISOString().split('T')[0]);
  };

  const setPresetAllTime = () => {
    setFinanceStartDate('');
    setFinanceEndDate('');
  };

  // Financial Calculations useMemo
  const { filteredFinanceOrders, totalRevenue, appliedFixed, totalVariable, netProfit, daysInPeriod, monthlyFixedSum } = useMemo(() => {
    const start = financeStartDate ? new Date(financeStartDate + 'T00:00:00') : null;
    const end = financeEndDate ? new Date(financeEndDate + 'T23:59:59') : null;

    const parseDateStr = (str: string, lang: string = 'pt') => {
      if (!str) return null;
      if (str.includes('-')) {
        const parts = str.split('-');
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            d.setHours(0,0,0,0);
            return d;
          }
        }
      }
      if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 3) {
          if (lang === 'en') {
            const d = new Date(parseInt(parts[2], 10), parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
            d.setHours(0,0,0,0);
            return d;
          } else {
            const d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
            d.setHours(0,0,0,0);
            return d;
          }
        }
      }
      const parsed = Date.parse(str);
      if (!isNaN(parsed)) {
        const d = new Date(parsed);
        d.setHours(0,0,0,0);
        return d;
      }
      return null;
    };

    // 1. Filter Orders
    const filteredOrders = orders.filter(order => {
      let orderDate: Date | null = null;
      if (order.pickupDate) {
        orderDate = parseDateStr(order.pickupDate, order.orderLanguage || settings.language || 'pt');
      }
      if (!orderDate && order.createdAt?.toDate) {
        orderDate = order.createdAt.toDate();
        orderDate.setHours(0, 0, 0, 0);
      }
      if (!orderDate) return false;
      if (start && orderDate < start) return false;
      if (end && orderDate > end) return false;
      return true;
    });

    const rev = filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);

    // 2. Fixed Costs
    const rent = settings.fixedRent || 0;
    const internet = settings.fixedInternet || 0;
    const electricity = settings.fixedElectricity || 0;
    const water = settings.fixedWater || 0;
    const gas = settings.fixedGas || 0;
    const sistemas = settings.fixedSistemas || 0;
    const marketing = settings.fixedMarketing || 0;
    const contabilidade = settings.fixedContabilidade || 0;
    const salarios = settings.fixedSalarios || 0;
    const mei = settings.fixedMei || 0;
    
    const customSum = settings.customFixedCosts
      ? settings.customFixedCosts.reduce((sum, item) => sum + (item.amount || 0), 0)
      : 0;

    const monthlySum = rent + internet + electricity + water + gas + sistemas + marketing + contabilidade + salarios + mei + customSum;

    // Calculate days difference
    let days = 30;
    if (financeStartDate && financeEndDate) {
      const s = new Date(financeStartDate + 'T00:00:00');
      const e = new Date(financeEndDate + 'T00:00:00');
      const diffTime = Math.abs(e.getTime() - s.getTime());
      days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    let appliedFix = monthlySum;
    if (isProportionalFixed && financeStartDate && financeEndDate) {
      appliedFix = (monthlySum / 30) * days;
    }

    // 3. Variable Costs
    const filteredVarCosts = variableCosts.filter(vc => {
      if (!vc.date) return false;
      const vcDate = new Date(vc.date + 'T12:00:00');
      if (start && vcDate < start) return false;
      if (end && vcDate > end) return false;
      return true;
    });

    const totVar = filteredVarCosts.reduce((sum, vc) => sum + (vc.amount || 0), 0);

    // 4. Net Profit
    const profit = rev - appliedFix - totVar;

    return {
      filteredFinanceOrders: filteredOrders,
      totalRevenue: rev,
      appliedFixed: appliedFix,
      totalVariable: totVar,
      netProfit: profit,
      daysInPeriod: days,
      monthlyFixedSum: monthlySum
    };
  }, [orders, settings, variableCosts, financeStartDate, financeEndDate, isProportionalFixed]);

  const computedEgnSheetData = useMemo(() => {
    const monthsData = [];
    let currentSaldoInicial = egnSheet.saldoInicialJaneiro || 0;

    for (let m = 0; m < 12; m++) {
      const dineroVal = (egnSheet.dinheiro && egnSheet.dinheiro[m]) || 0;
      const chequeVal = (egnSheet.cheque && egnSheet.cheque[m]) || 0;
      const duplicatasVal = (egnSheet.duplicatas && egnSheet.duplicatas[m]) || 0;
      const cartaoVal = (egnSheet.cartao && egnSheet.cartao[m]) || 0;
      const outrosVal = (egnSheet.outrosRecebimentos && egnSheet.outrosRecebimentos[m]) || 0;

      const totalEntradas = dineroVal + chequeVal + duplicatasVal + cartaoVal + outrosVal;

      const tributosVal = (egnSheet.tributos && egnSheet.tributos[m]) || 0;
      const suppliersVal = (egnSheet.fornecedores && egnSheet.fornecedores[m]) || 0;
      const retiradaVal = (egnSheet.retiradaProLabore && egnSheet.retiradaProLabore[m]) || 0;
      const salarioVal = (egnSheet.salarioEncargos && egnSheet.salarioEncargos[m]) || 0;
      const comissaoVal = (egnSheet.comissaoVendas && egnSheet.comissaoVendas[m]) || 0;
      const aguaVal = (egnSheet.agua && egnSheet.agua[m]) || 0;
      const luzVal = (egnSheet.luz && egnSheet.luz[m]) || 0;
      const aluguelVal = (egnSheet.aluguel && egnSheet.aluguel[m]) || 0;
      const telefoneVal = (egnSheet.telefoneInternet && egnSheet.telefoneInternet[m]) || 0;
      const despesasBancariasVal = (egnSheet.despesasBancarias && egnSheet.despesasBancarias[m]) || 0;
      const despesasFinanceirasVal = (egnSheet.despesasFinanceiras && egnSheet.despesasFinanceiras[m]) || 0;
      const honorariosVal = (egnSheet.honorariosContabeis && egnSheet.honorariosContabeis[m]) || 0;
      const veiculosVal = (egnSheet.veiculos && egnSheet.veiculos[m]) || 0;
      const escritorioVal = (egnSheet.escritorio && egnSheet.escritorio[m]) || 0;
      const manutencaoVal = (egnSheet.manutencao && egnSheet.manutencao[m]) || 0;
      const amortizacaoVal = (egnSheet.amortizacao && egnSheet.amortizacao[m]) || 0;
      const outrasVal = (egnSheet.outrasDespesas && egnSheet.outrasDespesas[m]) || 0;

      const totalSaidas = 
        tributosVal + suppliersVal + retiradaVal + salarioVal + comissaoVal + 
        aguaVal + luzVal + aluguelVal + telefoneVal + despesasBancariasVal + 
        despesasFinanceirasVal + honorariosVal + veiculosVal + escritorioVal + 
        manutencaoVal + amortizacaoVal + outrasVal;

      const saldoOperacional = totalEntradas - totalSaidas;
      const saldoAcumulado = currentSaldoInicial + saldoOperacional;

      monthsData.push({
        saldoInicial: currentSaldoInicial,
        totalEntradas,
        totalSaidas,
        saldoOperacional,
        saldoAcumulado
      });

      currentSaldoInicial = saldoAcumulado;
    }
    return monthsData;
  }, [egnSheet]);

  const handleResetEgnSheet = () => {
    const defaultData = {
      saldoInicialJaneiro: 1000,
      dinheiro: [1000, 2500, 2400, 2200, 1000, 0, 0, 0, 0, 0, 0, 0],
      cheque: [500, 1000, 560, 700, 700, 0, 0, 0, 0, 0, 0, 0],
      duplicatas: [3000, 2000, 1500, 2000, 2000, 0, 0, 0, 0, 0, 0, 0],
      cartao: [1100, 900, 800, 600, 600, 0, 0, 0, 0, 0, 0, 0],
      outrosRecebimentos: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      
      tributos: [600, 700, 650, 300, 300, 0, 0, 0, 0, 0, 0, 0],
      fornecedores: [1000, 1000, 900, 800, 800, 0, 0, 0, 0, 0, 0, 0],
      retiradaProLabore: [800, 800, 800, 800, 800, 0, 0, 0, 0, 0, 0, 0],
      salarioEncargos: [800, 800, 800, 800, 800, 0, 0, 0, 0, 0, 0, 0],
      comissaoVendas: [56, 64, 52.6, 55, 43, 0, 0, 0, 0, 0, 0, 0],
      agua: [50, 50, 50, 50, 50, 0, 0, 0, 0, 0, 0, 0],
      luz: [30, 30, 30, 30, 30, 0, 0, 0, 0, 0, 0, 0],
      aluguel: [500, 500, 500, 500, 500, 0, 0, 0, 0, 0, 0, 0],
      telefoneInternet: [50, 50, 50, 50, 50, 0, 0, 0, 0, 0, 0, 0],
      despesasBancarias: [40, 40, 40, 40, 40, 0, 0, 0, 0, 0, 0, 0],
      despesasFinanceiras: [20, 20, 20, 20, 20, 0, 0, 0, 0, 0, 0, 0],
      honorariosContabeis: [200, 200, 200, 200, 200, 0, 0, 0, 0, 0, 0, 0],
      veiculos: [100, 100, 100, 100, 100, 0, 0, 0, 0, 0, 0, 0],
      escritorio: [35, 35, 35, 35, 35, 0, 0, 0, 0, 0, 0, 0],
      manutencao: [0, 150, 0, 150, 0, 0, 0, 0, 0, 0, 0, 0],
      amortizacao: [100, 100, 100, 100, 100, 0, 0, 0, 0, 0, 0, 0],
      outrasDespesas: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    };
    setEgnSheet(defaultData);
    localStorage.setItem('egn_fluxo_caixa_simulacao_v5', JSON.stringify(defaultData));
    toast.success("Simulação de Exemplo EGN carregada com sucesso!");
  };

  const handleClearEgnSheet = () => {
    const clearData = {
      saldoInicialJaneiro: 0,
      dinheiro: Array(12).fill(0),
      cheque: Array(12).fill(0),
      duplicatas: Array(12).fill(0),
      cartao: Array(12).fill(0),
      outrosRecebimentos: Array(12).fill(0),
      tributos: Array(12).fill(0),
      fornecedores: Array(12).fill(0),
      retiradaProLabore: Array(12).fill(0),
      salarioEncargos: Array(12).fill(0),
      comissaoVendas: Array(12).fill(0),
      agua: Array(12).fill(0),
      luz: Array(12).fill(0),
      aluguel: Array(12).fill(0),
      telefoneInternet: Array(12).fill(0),
      despesasBancarias: Array(12).fill(0),
      despesasFinanceiras: Array(12).fill(0),
      honorariosContabeis: Array(12).fill(0),
      veiculos: Array(12).fill(0),
      escritorio: Array(12).fill(0),
      manutencao: Array(12).fill(0),
      amortizacao: Array(12).fill(0),
      outrasDespesas: Array(12).fill(0)
    };
    setEgnSheet(clearData);
    localStorage.setItem('egn_fluxo_caixa_simulacao_v5', JSON.stringify(clearData));
    toast.success("Todos os valores foram zerados!");
  };

  const handleSaveCurrentYear = (yearLabel: string) => {
    if (!yearLabel.trim()) {
      toast.error("Por favor, digite um ano ou identificador para salvar!");
      return;
    }
    const label = yearLabel.trim();
    const exists = savedYears.find(y => y.label.toLowerCase() === label.toLowerCase());
    let updated;
    if (exists) {
      if (!window.confirm(`Já existe uma planilha com o nome "${label}". Deseja substituí-la?`)) {
        return;
      }
      updated = savedYears.map(y => y.label.toLowerCase() === label.toLowerCase() ? {
        ...y,
        data: { ...egnSheet },
        date: new Date().toLocaleDateString('pt-BR')
      } : y);
      toast.success(`Planilha "${label}" atualizada!`);
    } else {
      const newItem = {
        id: Math.random().toString(36).substring(2),
        label,
        data: { ...egnSheet },
        date: new Date().toLocaleDateString('pt-BR')
      };
      updated = [newItem, ...savedYears];
      toast.success(`Planilha "${label}" salva no histórico!`);
    }
    setSavedYears(updated);
    localStorage.setItem('egn_fluxo_caixa_saved_years', JSON.stringify(updated));
    setNewYearLabel('');
  };

  const handleLoadSavedYear = (item: any) => {
    setViewingSavedYear(item);
    setEgnSheet(item.data);
    toast.success(`Planilha "${item.label}" carregada em modo de visualização!`);
  };

  const handleRestoreActiveSheet = () => {
    try {
      const saved = localStorage.getItem('egn_fluxo_caixa_simulacao_v5');
      if (saved) {
        setEgnSheet(JSON.parse(saved));
      } else {
        const clearData = {
          saldoInicialJaneiro: 0,
          dinheiro: Array(12).fill(0),
          cheque: Array(12).fill(0),
          duplicatas: Array(12).fill(0),
          cartao: Array(12).fill(0),
          outrosRecebimentos: Array(12).fill(0),
          tributos: Array(12).fill(0),
          fornecedores: Array(12).fill(0),
          retiradaProLabore: Array(12).fill(0),
          salarioEncargos: Array(12).fill(0),
          comissaoVendas: Array(12).fill(0),
          agua: Array(12).fill(0),
          luz: Array(12).fill(0),
          aluguel: Array(12).fill(0),
          telefoneInternet: Array(12).fill(0),
          despesasBancarias: Array(12).fill(0),
          despesasFinanceiras: Array(12).fill(0),
          honorariosContabeis: Array(12).fill(0),
          veiculos: Array(12).fill(0),
          escritorio: Array(12).fill(0),
          manutencao: Array(12).fill(0),
          amortizacao: Array(12).fill(0),
          outrasDespesas: Array(12).fill(0)
        };
        setEgnSheet(clearData);
      }
      setViewingSavedYear(null);
      toast.success("Voltou para a planilha de simulação ativa!");
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSavedYear = (id: string, label: string) => {
    if (window.confirm(`Deseja excluir "${label}" do histórico?`)) {
      const updated = savedYears.filter(y => y.id !== id);
      setSavedYears(updated);
      localStorage.setItem('egn_fluxo_caixa_saved_years', JSON.stringify(updated));
      toast.success(`Planilha "${label}" removida.`);
    }
  };

  const handleDownloadCSV = (item: any) => {
    const data = item.data;
    const monthsList = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    let csvContent = "Metodologia EGN;" + monthsList.join(";") + "\n";
    
    const monthsData = [];
    let currentSaldoInicial = data.saldoInicialJaneiro || 0;

    for (let m = 0; m < 12; m++) {
      const dineroVal = (data.dinheiro && data.dinheiro[m]) || 0;
      const chequeVal = (data.cheque && data.cheque[m]) || 0;
      const duplicatasVal = (data.duplicatas && data.duplicatas[m]) || 0;
      const cartaoVal = (data.cartao && data.cartao[m]) || 0;
      const outrosVal = (data.outrosRecebimentos && data.outrosRecebimentos[m]) || 0;

      const totalEntradas = dineroVal + chequeVal + duplicatasVal + cartaoVal + outrosVal;

      const tributosVal = (data.tributos && data.tributos[m]) || 0;
      const suppliersVal = (data.fornecedores && data.fornecedores[m]) || 0;
      const retiradaVal = (data.retiradaProLabore && data.retiradaProLabore[m]) || 0;
      const salarioVal = (data.salarioEncargos && data.salarioEncargos[m]) || 0;
      const comissaoVal = (data.comissaoVendas && data.comissaoVendas[m]) || 0;
      const aguaVal = (data.agua && data.agua[m]) || 0;
      const luzVal = (data.luz && data.luz[m]) || 0;
      const aluguelVal = (data.aluguel && data.aluguel[m]) || 0;
      const telefoneVal = (data.telefoneInternet && data.telefoneInternet[m]) || 0;
      const despesasBancariasVal = (data.despesasBancarias && data.despesasBancarias[m]) || 0;
      const despesasFinanceirasVal = (data.despesasFinanceiras && data.despesasFinanceiras[m]) || 0;
      const honorariosVal = (data.honorariosContabeis && data.honorariosContabeis[m]) || 0;
      const veiculosVal = (data.veiculos && data.veiculos[m]) || 0;
      const escritorioVal = (data.escritorio && data.escritorio[m]) || 0;
      const manutencaoVal = (data.manutencao && data.manutencao[m]) || 0;
      const amortizacaoVal = (data.amortizacao && data.amortizacao[m]) || 0;
      const outrasVal = (data.outrasDespesas && data.outrasDespesas[m]) || 0;

      const totalSaidas = 
        tributosVal + suppliersVal + retiradaVal + salarioVal + comissaoVal + 
        aguaVal + luzVal + aluguelVal + telefoneVal + despesasBancariasVal + 
        despesasFinanceirasVal + honorariosVal + veiculosVal + escritorioVal + 
        manutencaoVal + amortizacaoVal + outrasVal;

      const saldoOperacional = totalEntradas - totalSaidas;
      const saldoAcumulado = currentSaldoInicial + saldoOperacional;

      monthsData.push({
        saldoInicial: currentSaldoInicial,
        dinheiro: dineroVal,
        cheque: chequeVal,
        duplicatas: duplicatasVal,
        cartao: cartaoVal,
        outrosRecebimentos: outrosVal,
        totalEntradas,
        tributos: tributosVal,
        fornecedores: suppliersVal,
        retiradaProLabore: retiradaVal,
        salarioEncargos: salarioVal,
        comissaoVendas: comissaoVal,
        agua: aguaVal,
        luz: luzVal,
        aluguel: aluguelVal,
        telefoneInternet: telefoneVal,
        despesasBancarias: despesasBancariasVal,
        despesasFinanceiras: despesasFinanceirasVal,
        honorariosContabeis: honorariosVal,
        veiculos: veiculosVal,
        escritorio: escritorioVal,
        manutencao: manutencaoVal,
        amortizacao: amortizacaoVal,
        outrasDespesas: outrasVal,
        totalSaidas,
        saldoOperacional,
        saldoAcumulado
      });

      currentSaldoInicial = saldoAcumulado;
    }

    const exportRows = [
      { title: "Saldo inicial em caixa e banco", values: monthsData.map((d, idx) => idx === 0 ? (data.saldoInicialJaneiro || 0) : d.saldoInicial) },
      { title: "RECEITAS / ENTRADAS", isHeader: true },
      { title: "Dinheiro", values: monthsData.map(d => d.dinheiro) },
      { title: "Cheque pré-datado", values: monthsData.map(d => d.cheque) },
      { title: "Duplicatas a receber", values: monthsData.map(d => d.duplicatas) },
      { title: "Cartão de crédito", values: monthsData.map(d => d.cartao) },
      { title: "Outros recebimentos", values: monthsData.map(d => d.outrosRecebimentos) },
      { title: "Total de entradas", values: monthsData.map(d => d.totalEntradas) },
      { title: "DESPESAS / SAÍDAS", isHeader: true },
      { title: "Tributos (DAS - MEI)", values: monthsData.map(d => d.tributos) },
      { title: "Pagamento a fornecedores", values: monthsData.map(d => d.fornecedores) },
      { title: "Retirada mensal do proprietário", values: monthsData.map(d => d.retiradaProLabore) },
      { title: "Salário do funcionário e encargos", values: monthsData.map(d => d.salarioEncargos) },
      { title: "Comissão sobre vendas", values: monthsData.map(d => d.comissaoVendas) },
      { title: "Água", values: monthsData.map(d => d.agua) },
      { title: "Luz", values: monthsData.map(d => d.luz) },
      { title: "Aluguel", values: monthsData.map(d => d.aluguel) },
      { title: "Telefone / internet", values: monthsData.map(d => d.telefoneInternet) },
      { title: "Despesas bancárias", values: monthsData.map(d => d.despesasBancarias) },
      { title: "Despesas financeiras", values: monthsData.map(d => d.despesasFinanceiras) },
      { title: "Honorários contábeis", values: monthsData.map(d => d.honorariosContabeis) },
      { title: "Despesa com veículos", values: monthsData.map(d => d.veiculos) },
      { title: "Materiais de escritório", values: monthsData.map(d => d.escritorio) },
      { title: "Manutenção de equipamentos", values: monthsData.map(d => d.manutencao) },
      { title: "Amortização de empréstimos", values: monthsData.map(d => d.amortizacao) },
      { title: "Outras despesas", values: monthsData.map(d => d.outrasDespesas) },
      { title: "Total de saída", values: monthsData.map(d => d.totalSaidas) },
      { title: "Saldo operacional (Entradas - Saídas)", values: monthsData.map(d => d.saldoOperacional) },
      { title: "Saldo acumulado", values: monthsData.map(d => d.saldoAcumulado) }
    ];

    exportRows.forEach(row => {
      if (row.isHeader) {
        csvContent += `\n--- ${row.title} ---\n`;
      } else {
        const formattedValues = row.values?.map(val => val.toFixed(2).replace('.', ',')) || [];
        csvContent += `${row.title};` + formattedValues.join(";") + "\n";
      }
    });

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Planilha_Fluxo_Caixa_${item.label.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Planilha "${item.label}" baixada com sucesso!`);
  };

  const handleCellChange = (rowKey: string, monthIndex: number, val: string) => {
    const num = val === '' ? 0 : parseFloat(val) || 0;
    setEgnSheet(prev => {
      const updated = { ...prev };
      if (rowKey === 'saldoInicialJaneiro') {
        updated.saldoInicialJaneiro = num;
      } else {
        const arr = [...((prev as any)[rowKey] || [])];
        arr[monthIndex] = num;
        (updated as any)[rowKey] = arr;
      }
      localStorage.setItem('egn_fluxo_caixa_simulacao_v5', JSON.stringify(updated));
      return updated;
    });
  };

  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const sheetRows = [
    {
      section: 'Inicial',
      title: 'Saldo inicial em caixa e banco',
      key: 'saldoInicial',
      isComputed: true,
      instruction: 'Informe aqui a soma do saldo em caixa e banco no início do mês. Para meses subsequentes ao primeiro mês de preenchimento da planilha, o valor será sempre o "Saldo acumulado" do mês anterior.',
      bgColor: 'bg-[#fcf8e3]'
    },
    {
      section: 'Entradas',
      title: 'RECEITAS / ENTRADAS',
      isHeader: true,
      bgColor: 'bg-[#e2f0d9] font-bold text-[#385723] uppercase text-[10px] tracking-wider'
    },
    {
      section: 'Entradas',
      title: 'Dinheiro',
      key: 'dinheiro',
      instruction: 'Informe aqui os valores previstos para entrarem na empresa em dinheiro físico.',
      bgColor: ''
    },
    {
      section: 'Entradas',
      title: 'Cheque pré-datado',
      key: 'cheque',
      instruction: 'Informe aqui os valores previstos de cheques a serem descontados ou compensados.',
      bgColor: ''
    },
    {
      section: 'Entradas',
      title: 'Duplicatas a receber',
      key: 'duplicatas',
      instruction: 'Valores a receber de vendas por faturamento/boleto ou duplicatas.',
      bgColor: ''
    },
    {
      section: 'Entradas',
      title: 'Cartão de crédito',
      key: 'cartao',
      instruction: 'Valores previstos de recebíveis de vendas pagas no cartão de crédito/débito.',
      bgColor: ''
    },
    {
      section: 'Entradas',
      title: 'Outros recebimentos',
      key: 'outrosRecebimentos',
      instruction: 'Qualquer outro tipo de entrada previsto (PIX, transferências bancárias, etc).',
      bgColor: ''
    },
    {
      section: 'Entradas',
      title: 'Total de entradas',
      key: 'totalEntradas',
      isComputed: true,
      instruction: 'Resultado da soma de todas as receitas de entradas previstas em cada mês.',
      bgColor: 'bg-[#dff0d8] font-black border-t border-gray-300'
    },
    {
      section: 'Saídas',
      title: 'DESPESAS / SAÍDAS',
      isHeader: true,
      bgColor: 'bg-[#fce4d6] font-bold text-[#c65911] uppercase text-[10px] tracking-wider'
    },
    {
      section: 'Saídas',
      title: 'Tributos (DAS – MEI¹)',
      key: 'tributos',
      instruction: 'DAS do Microempreendedor Individual ou outros tributos, taxas e impostos federais/municipais/estaduais.',
      bgColor: ''
    },
    {
      section: 'Saídas',
      title: 'Pagamento a fornecedores',
      key: 'fornecedores',
      instruction: 'Previsões de pagamentos para compras de ingredientes, insumos e mercadorias para produção.',
      bgColor: ''
    },
    {
      section: 'Saídas',
      title: 'Retirada mensal do proprietário',
      key: 'retiradaProLabore',
      instruction: 'O pró-labore (salário fixo mensal) do proprietário da empresa.',
      bgColor: ''
    },
    {
      section: 'Saídas',
      title: 'Salário do funcionário e encargos',
      key: 'salarioEncargos',
      instruction: 'Folha de pagamento de colaboradores fixos ou temporários e taxas agregadas (FGTS, INSS, etc).',
      bgColor: ''
    },
    {
      section: 'Saídas',
      title: 'Comissão sobre vendas²',
      key: 'comissaoVendas',
      instruction: 'Valores pagos a terceiros ou funcionários como incentivo ou percentual de vendas.',
      bgColor: ''
    },
    {
      section: 'Saídas',
      title: 'Água',
      key: 'agua',
      instruction: 'Custo previsto mensal com a conta de água do local de trabalho.',
      bgColor: ''
    },
    {
      section: 'Saídas',
      title: 'Luz',
      key: 'luz',
      instruction: 'Custo previsto mensal com a conta de energia elétrica.',
      bgColor: ''
    },
    {
      section: 'Saídas',
      title: 'Aluguel',
      key: 'aluguel',
      instruction: 'Valor mensal fixado do contrato de aluguel do espaço físico comercial.',
      bgColor: ''
    },
    {
      section: 'Saídas',
      title: 'Telefone / internet',
      key: 'telefoneInternet',
      instruction: 'Plano de internet e telefone utilizados para atendimento e operação do negócio.',
      bgColor: ''
    },
    {
      section: 'Saídas',
      title: 'Despesas bancárias',
      key: 'despesasBancarias',
      instruction: 'Tarifas mensais de conta jurídica, taxas de pix, anuidade de cartões corporativos, etc.',
      bgColor: ''
    },
    {
      section: 'Saídas',
      title: 'Despesas financeiras',
      key: 'despesasFinanceiras',
      instruction: 'Juros cobrados, taxas de antecipação de recebíveis, impostos financeiros (IOF), etc.',
      bgColor: ''
    },
    {
      section: 'Saídas',
      title: 'Honorários contábeis³',
      key: 'honorariosContabeis',
      instruction: 'Custo mensal com serviço de contabilidade (Apenas se contratado profissional).',
      bgColor: ''
    },
    {
      section: 'Saídas',
      title: 'Despesa com veículos',
      key: 'veiculos',
      instruction: 'Gasto com combustível, IPVA, seguro, manutenção ou depreciação de veículos usados na entrega ou operação.',
      bgColor: ''
    },
    {
      section: 'Saídas',
      title: 'Materiais de escritório',
      key: 'escritorio',
      instruction: 'Gasto pontual ou regular com papel, canetas, toners de impressora, blocos de pedidos, etc.',
      bgColor: ''
    },
    {
      section: 'Saídas',
      title: 'Manutenção de equipamentos',
      key: 'manutencao',
      instruction: 'Consertos, revisões ou manutenção de fornos, batedeiras, freezers e maquinário essencial.',
      bgColor: ''
    },
    {
      section: 'Saídas',
      title: 'Amortização de empréstimos e fin.',
      key: 'amortizacao',
      instruction: 'Parcelas pagas mensalmente relativas a empréstimos tomados pela empresa para capital de giro ou investimento.',
      bgColor: ''
    },
    {
      section: 'Saídas',
      title: 'Outras despesas',
      key: 'outrasDespesas',
      instruction: 'Qualquer outro tipo de despesa, saída ou imprevisto financeiro que ocorra no mês.',
      bgColor: ''
    },
    {
      section: 'Saídas',
      title: 'Total de saída',
      key: 'totalSaidas',
      isComputed: true,
      instruction: 'Resultado da soma de todas as despesas e saídas de caixa previstas em cada mês.',
      bgColor: 'bg-[#f2dede] font-black border-t border-gray-300'
    },
    {
      section: 'Resumo',
      title: 'Saldo operacional (Entradas - Saídas)',
      key: 'saldoOperacional',
      isComputed: true,
      instruction: 'Resultado mensal da diferença entre o que entrou de recursos e o que saiu de caixa.',
      bgColor: 'bg-[#d5ebd1] font-black text-[#2e5621] border-t-2 border-gray-300'
    },
    {
      section: 'Resumo',
      title: 'Saldo acumulado',
      key: 'saldoAcumulado',
      isComputed: true,
      instruction: 'Resultado acumulado ao final do mês, somando o saldo operacional com o saldo inicial que havia em caixa/banco.',
      bgColor: 'bg-[#fce4d6] font-black text-[#843c0c] border-t-2 border-gray-300'
    }
  ];

  const currencySymbol = settings?.currency === 'USD' ? '$' : 'R$';

  if (!isLoggedIn) {
    return (
      <div className="flex-grow flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass p-8 rounded-3xl w-full max-w-md shadow-2xl"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="h-24 w-24 flex items-center justify-center mb-4 rounded-full overflow-hidden border-2 border-white shadow-md bg-white">
              <img src={settings?.logo} alt="Logotipo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <h1 className="text-2xl font-serif font-bold opacity-90">Painel Administrativo</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password" 
              placeholder="Senha de acesso"
              className="w-full p-4 rounded-xl border border-gray-300 focus:ring-2 outline-none"
              style={{ '--tw-ring-color': settings?.primaryColor || '#865d39' } as any}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button 
              type="submit"
              className="w-full py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-all"
              style={{ 
                backgroundColor: settings?.primaryColor || '#865d39',
                color: getContrastText(settings?.primaryColor || '#865d39')
              }}
            >
              Entrar
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-grow flex flex-col md:flex-row md:h-screen md:overflow-hidden text-gray-900">
      <div className="w-full md:w-64 glass border-r border-white/20 p-4 md:p-6 flex flex-col gap-4 md:gap-8 md:overflow-y-auto">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 flex items-center justify-center rounded-full overflow-hidden border border-white/50 bg-white shadow-sm">
            <img src={settings?.logo} alt="Logotipo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <span className="font-serif font-bold text-lg opacity-90">{settings?.brandName || 'Lu das marmitas'}</span>
        </div>
        
        <nav className="flex flex-col gap-2">
          <button 
            onClick={() => setActiveTab('orders')}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-all font-semibold",
              activeTab === 'orders' ? "shadow-lg font-bold" : "hover:bg-white/30 text-black"
            )}
            style={activeTab === 'orders' ? { backgroundColor: settings?.primaryColor || '#865d39', color: getContrastText(settings?.primaryColor || '#865d39') } : {}}
          >
            <History size={20} /> Histórico de Pedidos
          </button>
          <button 
            onClick={() => setActiveTab('customers')}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-all font-semibold",
              activeTab === 'customers' ? "shadow-lg font-bold" : "hover:bg-white/30 text-black"
            )}
            style={activeTab === 'customers' ? { backgroundColor: settings?.primaryColor || '#865d39', color: getContrastText(settings?.primaryColor || '#865d39') } : {}}
          >
            <Users size={20} /> Clientes
          </button>
          <button 
            onClick={() => setActiveTab('categories')}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-all font-semibold",
              activeTab === 'categories' ? "shadow-lg font-bold" : "hover:bg-white/30 text-black"
            )}
            style={activeTab === 'categories' ? { backgroundColor: settings?.primaryColor || '#865d39', color: getContrastText(settings?.primaryColor || '#865d39') } : {}}
          >
            <Layers size={20} /> Categorias
          </button>
          <button 
            onClick={() => setActiveTab('menu')}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-all font-semibold",
              activeTab === 'menu' ? "shadow-lg font-bold" : "hover:bg-white/30 text-black"
            )}
            style={activeTab === 'menu' ? { backgroundColor: settings?.primaryColor || '#865d39', color: getContrastText(settings?.primaryColor || '#865d39') } : {}}
          >
            <Package size={20} /> Gerenciar Cardápio
          </button>

          <button 
            onClick={() => setActiveTab('orderMenu')}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-all font-semibold",
              activeTab === 'orderMenu' ? "shadow-lg font-bold" : "hover:bg-white/30 text-black"
            )}
            style={activeTab === 'orderMenu' ? { backgroundColor: settings?.primaryColor || '#865d39', color: getContrastText(settings?.primaryColor || '#865d39') } : {}}
          >
            <ArrowUpDown size={20} /> Ordenar Cardápio
          </button>

          <button 
            id="tab-btn-supplies"
            onClick={() => setActiveTab('supplies')}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-all font-semibold",
              activeTab === 'supplies' ? "shadow-lg font-bold" : "hover:bg-white/30 text-black"
            )}
            style={activeTab === 'supplies' ? { backgroundColor: settings?.primaryColor || '#865d39', color: getContrastText(settings?.primaryColor || '#865d39') } : {}}
          >
            <ShoppingBag size={20} /> Recomendações da Chef
          </button>

          <button 
            onClick={() => setActiveTab('finance')}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-all font-semibold",
              activeTab === 'finance' ? "shadow-lg font-bold" : "hover:bg-white/30 text-black"
            )}
            style={activeTab === 'finance' ? { backgroundColor: settings?.primaryColor || '#865d39', color: getContrastText(settings?.primaryColor || '#865d39') } : {}}
          >
            <DollarSign size={20} /> Financeiro
          </button>

          <button 
            onClick={() => setActiveTab('settings')}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-all font-semibold",
              activeTab === 'settings' ? "shadow-lg font-bold" : "hover:bg-white/30 text-black"
            )}
            style={activeTab === 'settings' ? { backgroundColor: settings?.primaryColor || '#865d39', color: getContrastText(settings?.primaryColor || '#865d39') } : {}}
          >
            <SettingsIcon size={20} /> Configurações
          </button>
        </nav>

        <button 
          onClick={() => {
            setIsLoggedIn(false);
            setIsAdmin(false);
            window.history.pushState({}, '', '/');
          }}
          className="mt-auto flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 text-red-600 transition-all font-bold"
        >
          <LogOut size={20} /> Sair
        </button>
      </div>

      <main id="admin-main-content" className="flex-grow p-4 md:p-10 overflow-y-auto min-w-0 w-full">
        {activeTab === 'supplies' && (
          <AdminSupplies settings={settings} />
        )}

        {activeTab === 'finance' && (
          <div className="max-w-6xl space-y-8 pb-10">
            {/* Header Card */}
            <div className="bg-white/95 backdrop-blur-md p-6 sm:p-7 rounded-3xl border border-gray-200/90 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0"
                    style={{ backgroundColor: settings.primaryColor || '#865d39' }}
                  >
                    <DollarSign size={24} />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-serif font-black text-gray-900">
                      Painel Financeiro
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-600 font-medium mt-0.5">
                      Monitore receitas, custos fixos, custos variáveis e o lucro líquido do seu negócio.
                    </p>
                  </div>
                </div>
              </div>

              {/* Date Filters */}
              {financeSubTab === 'real' && (
                <div className="flex flex-col gap-2 bg-gray-50/90 p-4 rounded-2xl border border-gray-200 shadow-inner shrink-0">
                  <div className="text-[10px] font-black uppercase tracking-wider text-gray-600">Filtrar por Período</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded-xl px-3 py-1.5 shadow-xs">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">De:</span>
                      <input 
                        type="date" 
                        className="border-0 bg-transparent text-xs font-bold text-gray-800 outline-none cursor-pointer"
                        value={financeStartDate}
                        onChange={e => setFinanceStartDate(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded-xl px-3 py-1.5 shadow-xs">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Até:</span>
                      <input 
                        type="date" 
                        className="border-0 bg-transparent text-xs font-bold text-gray-800 outline-none cursor-pointer"
                        value={financeEndDate}
                        onChange={e => setFinanceEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <button onClick={setPresetThisMonth} className="px-2.5 py-1 text-[10px] font-bold uppercase bg-white hover:bg-gray-100 text-gray-700 rounded-lg transition-all cursor-pointer border border-gray-200 shadow-xs">Este Mês</button>
                    <button onClick={setPresetLastMonth} className="px-2.5 py-1 text-[10px] font-bold uppercase bg-white hover:bg-gray-100 text-gray-700 rounded-lg transition-all cursor-pointer border border-gray-200 shadow-xs">Mês Passado</button>
                    <button onClick={setPresetLast30Days} className="px-2.5 py-1 text-[10px] font-bold uppercase bg-white hover:bg-gray-100 text-gray-700 rounded-lg transition-all cursor-pointer border border-gray-200 shadow-xs">Últimos 30 dias</button>
                    <button onClick={setPresetAllTime} className="px-2.5 py-1 text-[10px] font-bold uppercase bg-white hover:bg-gray-100 text-gray-700 rounded-lg transition-all cursor-pointer border border-gray-200 shadow-xs">Ver Tudo</button>
                  </div>
                </div>
              )}
            </div>

            {/* Sub-tab Selectors */}
            <div className="bg-white/95 p-1.5 rounded-2xl border border-gray-200/90 shadow-sm inline-flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFinanceSubTab('real')}
                className={cn(
                  "px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-2 border",
                  financeSubTab === 'real'
                    ? "shadow-md text-white border-transparent"
                    : "bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200"
                )}
                style={financeSubTab === 'real' ? { 
                  backgroundColor: settings.primaryColor || '#865d39', 
                  color: getContrastText(settings.primaryColor || '#865d39') 
                } : {}}
              >
                <Coins size={15} />
                Painel Real (Vendas + Custos)
              </button>
              <button
                type="button"
                onClick={() => setFinanceSubTab('simulation')}
                className={cn(
                  "px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-2 border",
                  financeSubTab === 'simulation'
                    ? "shadow-md text-white border-transparent"
                    : "bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200"
                )}
                style={financeSubTab === 'simulation' ? { 
                  backgroundColor: settings.primaryColor || '#865d39', 
                  color: getContrastText(settings.primaryColor || '#865d39') 
                } : {}}
              >
                <Table size={15} />
                Planilha EGN (Fluxo de Caixa)
              </button>
            </div>

            {financeSubTab === 'simulation' ? (
              <div className="space-y-6 animate-fade-in">
                {/* Intro Card */}
                <div className="bg-white/95 backdrop-blur-md border border-gray-200/90 rounded-3xl p-6 sm:p-7 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <h2 className="text-xl font-serif font-black flex items-center gap-2 text-gray-900">
                      <Table size={22} style={{ color: settings.primaryColor || '#865d39' }} /> Planilha de Simulação de Fluxo de Caixa (Metodologia EGN)
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-700 font-medium leading-relaxed max-w-3xl">
                      Esta planilha interativa foi desenhada especificamente seguindo a metodologia da nossa Escola de Gastronomia e Negócios. Ela calcula automaticamente os totais de entradas, saídas, saldos operacionais e acumula os valores mês a mês para que você possa planejar e prever a saúde financeira do seu negócio.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {viewingSavedYear ? (
                      <button
                        type="button"
                        onClick={handleRestoreActiveSheet}
                        className="px-4 py-2.5 text-xs font-black uppercase tracking-wider bg-amber-600 hover:bg-amber-700 text-white rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-sm border-0 animate-pulse"
                      >
                        <ArrowLeft size={14} /> Voltar à Planilha Ativa
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleClearEgnSheet}
                        className="px-4 py-2.5 text-xs font-black uppercase tracking-wider bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-sm font-bold"
                      >
                        <Trash2 size={14} /> Limpar Planilha (Zerar)
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                  {/* Left: Instruction panel (1/4 space on desktop) */}
                  <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm">
                      <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-3">
                        <Info size={16} style={{ color: settings.primaryColor || '#865d39' }} />
                        <h3 className="font-serif font-black text-sm text-gray-800">Guia de Instruções EGN</h3>
                      </div>
                      
                      <p className="text-[11px] text-gray-500 font-medium mb-4 leading-relaxed">
                        Selecione qualquer linha na planilha para ver abaixo a instrução detalhada de como preenchê-la e seu propósito na metodologia.
                      </p>

                      <div className="bg-amber-50/70 border border-amber-200/60 p-4 rounded-xl min-h-[160px] flex flex-col justify-between">
                        <div>
                          <div className="text-[10px] font-bold text-amber-800/80 uppercase tracking-wider mb-1.5">Instrução Contextual</div>
                          <p className="text-xs text-amber-900 leading-relaxed font-semibold">
                            {selectedInstruction || "Selecione uma linha para visualizar a instrução de preenchimento."}
                          </p>
                        </div>
                        <div className="text-[9px] text-amber-800/60 font-bold mt-4 italic">
                          Dica: Os totais e saldos são recalculados em tempo real!
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#fcfcf9] border border-[#f0eee0] rounded-2xl p-5">
                      <h4 className="font-serif font-black text-xs uppercase tracking-wider mb-3" style={{ color: settings.primaryColor || '#865d39' }}>Metodologia Passo a Passo</h4>
                      <ul className="space-y-3 text-[11px] text-gray-600 font-medium">
                        <li className="flex items-start gap-2">
                          <span className="w-4 h-4 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">1</span>
                          <span><strong>Insira o Saldo Inicial</strong> em Janeiro para começar a simulação de caixa.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-4 h-4 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">2</span>
                          <span><strong>Preencha as Receitas</strong> estimadas futuras (dinheiro, cheque, duplicatas, cartão).</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-4 h-4 bg-rose-100 text-rose-800 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">3</span>
                          <span><strong>Estime as Despesas</strong> correspondentes para cada mês.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-4 h-4 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">4</span>
                          <span><strong>Analise o Saldo Acumulado</strong> no final do ano para prever a saúde financeira.</span>
                        </li>
                      </ul>
                    </div>

                    {/* Save / Load Saved Years historical panel */}
                    <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm space-y-4">
                      <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                        <History size={16} style={{ color: settings.primaryColor || '#865d39' }} />
                        <h3 className="font-serif font-black text-sm text-gray-800">Salvar / Carregar Anos</h3>
                      </div>
                      
                      <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                        Salve o resultado do seu ano (por exemplo, "Ano de 2026") para poder consultá-lo, carregá-lo de volta ou comparar simulações no futuro.
                      </p>

                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSaveCurrentYear(newYearLabel);
                        }}
                        className="space-y-2"
                      >
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Ex: Ano 2026, Prev. Otimista"
                            value={newYearLabel}
                            onChange={(e) => setNewYearLabel(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#865d39] placeholder:text-gray-400 bg-gray-50/50"
                          />
                          <button
                            type="submit"
                            className="w-full py-2 bg-[#865d39] hover:bg-[#6c4a2d] text-white font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 border-0 shadow-sm"
                            style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}
                          >
                            <Save size={14} /> Salvar Planilha Atual
                          </button>
                        </div>
                      </form>

                      {savedYears.length > 0 ? (
                        <div className="space-y-2 pt-2 border-t border-gray-100">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Planilhas Salvas:</span>
                          <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1">
                            {savedYears.map((item) => (
                              <div 
                                key={item.id} 
                                className="flex items-center justify-between p-2 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100/70 transition-all text-xs"
                              >
                                <div 
                                  onClick={() => handleLoadSavedYear(item)}
                                  className="flex-1 cursor-pointer font-bold text-gray-700 truncate mr-2 hover:text-[#865d39] transition-colors flex flex-col"
                                  title="Carregar Planilha no Simulador"
                                >
                                  <span className="truncate">{item.label}</span>
                                  <span className="text-[9px] text-gray-400 font-normal">Salvo em {item.date}</span>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleLoadSavedYear(item)}
                                    title="Carregar Planilha no Simulador"
                                    className="p-1 text-gray-500 hover:text-[#865d39] hover:bg-amber-50 rounded-lg cursor-pointer border-0 bg-transparent"
                                  >
                                    <Eye size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadCSV(item)}
                                    title="Baixar Planilha (CSV / Excel)"
                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer border-0 bg-transparent"
                                  >
                                    <Download size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSavedYear(item.id, item.label)}
                                    title="Excluir"
                                    className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer border-0 bg-transparent"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center p-3 border border-dashed border-gray-200 rounded-xl bg-gray-50/50 text-[11px] text-gray-400 font-medium">
                          Nenhuma planilha salva no histórico ainda.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Big scrollable spreadsheet table (3/4 space on desktop) */}
                  <div className="lg:col-span-3 space-y-4">
                    <div className="bg-white border border-gray-200/80 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                      {viewingSavedYear && (
                        <div className="bg-amber-50 border-b border-amber-200/80 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <Eye className="text-amber-700 animate-pulse shrink-0" size={20} />
                            <div>
                              <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Modo de Visualização Histórica</div>
                              <p className="text-xs text-amber-950 font-semibold">
                                Você está visualizando os dados de <strong className="font-bold">"{viewingSavedYear.label}"</strong> (salvo em {viewingSavedYear.date}).
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleRestoreActiveSheet}
                            className="px-4 py-2 text-[10px] font-black uppercase tracking-wider bg-amber-700 hover:bg-amber-800 text-white rounded-xl transition-all cursor-pointer border-0 shadow-sm flex items-center gap-1.5 shrink-0"
                          >
                            <ArrowLeft size={12} /> Voltar à Planilha Ativa
                          </button>
                        </div>
                      )}
                      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Simulador de Fluxo de Caixa</span>
                        <span className="text-[10px] text-gray-400 font-bold uppercase bg-white px-2 py-1 rounded-md border border-gray-200">Arraste para o lado para ver todos os meses →</span>
                      </div>
                      
                      <div className="overflow-x-auto max-w-full">
                        <table className="w-full text-xs text-left text-gray-500 border-collapse table-fixed">
                          <thead>
                            <tr className="text-white text-[10px] font-black uppercase tracking-wider bg-zinc-800">
                              <th className="sticky left-0 z-20 px-3 py-2.5 w-[220px] shrink-0 border border-gray-400/30 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.15)] bg-zinc-800">Metodologia EGN</th>
                              {months.map((m, idx) => (
                                <th key={idx} className="px-2.5 py-2.5 w-[105px] text-center border border-gray-400/30">{m}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sheetRows.map((row, rIdx) => {
                              if (row.isHeader) {
                                return (
                                  <tr key={rIdx} className={`${row.bgColor} border-y border-gray-300/60`}>
                                    <td colSpan={13} className="px-3 py-1.5 font-black text-[10px] tracking-wider select-none">
                                      {row.title}
                                    </td>
                                  </tr>
                                );
                              }

                              const isComputed = row.isComputed;
                              const rowKey = row.key;

                              return (
                                <tr 
                                  key={rIdx} 
                                  onClick={() => row.instruction && setSelectedInstruction(row.instruction)}
                                  className={cn(
                                    "border-b border-gray-200 hover:bg-amber-50/40 transition-colors cursor-pointer",
                                    row.bgColor,
                                    selectedInstruction === row.instruction && "bg-amber-50"
                                  )}
                                >
                                  {/* Row Title Column (Sticky) */}
                                  <td className={cn(
                                    "sticky left-0 bg-white font-semibold text-gray-800 text-[11px] px-3 py-2 border-r border-gray-200 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.15)] flex items-center justify-between gap-1.5",
                                    row.bgColor,
                                    isComputed && "font-bold"
                                  )}>
                                    <span className="truncate">{row.title}</span>
                                    {row.instruction && (
                                      <Info size={11} className="text-gray-400 shrink-0 hover:text-[#865d39] transition-colors" />
                                    )}
                                  </td>

                                  {/* Month values */}
                                  {months.map((_, mIdx) => {
                                    // Handle Saldo Inicial specially
                                    if (rowKey === 'saldoInicial') {
                                      const isJan = mIdx === 0;
                                      if (isJan) {
                                        return (
                                          <td key={mIdx} className="px-1 py-1 border-r border-gray-200">
                                            <div className="flex items-center gap-0.5 px-1 bg-amber-50 rounded-lg border border-amber-200/50">
                                              <span className="text-[9px] text-amber-700/60 font-bold">$</span>
                                              <input
                                                type="number"
                                                className="w-full bg-transparent p-1 text-center font-bold text-gray-800 text-xs focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-75"
                                                value={egnSheet.saldoInicialJaneiro === 0 ? '' : egnSheet.saldoInicialJaneiro || ''}
                                                placeholder="0"
                                                onChange={(e) => handleCellChange('saldoInicialJaneiro', 0, e.target.value)}
                                                disabled={!!viewingSavedYear}
                                              />
                                            </div>
                                          </td>
                                        );
                                      } else {
                                        const val = computedEgnSheetData[mIdx]?.saldoInicial || 0;
                                        return (
                                          <td key={mIdx} className="px-2 py-1.5 text-center font-bold text-gray-700 border-r border-gray-200 bg-gray-50/50">
                                            {val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </td>
                                        );
                                      }
                                    }

                                    // Handle computed totals
                                    if (isComputed) {
                                      let computedVal = 0;
                                      if (rowKey === 'totalEntradas') computedVal = computedEgnSheetData[mIdx]?.totalEntradas || 0;
                                      else if (rowKey === 'totalSaidas') computedVal = computedEgnSheetData[mIdx]?.totalSaidas || 0;
                                      else if (rowKey === 'saldoOperacional') computedVal = computedEgnSheetData[mIdx]?.saldoOperacional || 0;
                                      else if (rowKey === 'saldoAcumulado') computedVal = computedEgnSheetData[mIdx]?.saldoAcumulado || 0;

                                      return (
                                        <td 
                                          key={mIdx} 
                                          className={cn(
                                            "px-2 py-1.5 text-center font-bold border-r border-gray-200",
                                            rowKey === 'saldoOperacional' && (computedVal >= 0 ? "text-emerald-700" : "text-rose-700"),
                                            rowKey === 'saldoAcumulado' && (computedVal >= 0 ? "text-[#385723] bg-[#d5ebd1]" : "text-[#c65911] bg-[#fce4d6]")
                                          )}
                                        >
                                          {computedVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                      );
                                    }

                                    // Handle normal input cell
                                    const valArr = (egnSheet as any)[rowKey!] || [];
                                    const rawVal = valArr[mIdx];
                                    return (
                                      <td key={mIdx} className="px-1 py-1 border-r border-gray-200">
                                        <input
                                          type="number"
                                          className="w-full bg-transparent p-1 text-center font-medium text-gray-800 text-xs focus:bg-amber-50/50 focus:outline-none rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-75"
                                          value={rawVal === 0 ? '' : rawVal || ''}
                                          placeholder="0"
                                          onChange={(e) => handleCellChange(rowKey!, mIdx, e.target.value)}
                                          disabled={!!viewingSavedYear}
                                        />
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Explanatory notes */}
                    <div className="bg-[#fcfcf9] border border-[#f0eee0] rounded-2xl p-5 space-y-3">
                      <div className="text-[10px] font-black uppercase tracking-wider text-gray-500">Notas Metodológicas Importantes</div>
                      <ol className="list-decimal list-inside space-y-2 text-[11px] text-gray-600 font-medium leading-relaxed">
                        <li>
                          <strong>Em tributos considera-se:</strong> impostos, taxas, contribuições, entre outros. No caso do MEI, refere-se à "DAS".
                        </li>
                        <li>
                          <strong>Lembramos que ao MEI:</strong> conforme resolução 94/11 do CGSN, art.96, §4º, é vedado o pagamento de comissões sobre vendas a seu funcionário. Assim, este item do controle deve ser desconsiderado pelo Microempreendedor Individual.
                        </li>
                        <li>
                          <strong>Destacamos que ao MEI:</strong> não é obrigatória a contratação de um contador. Neste caso, os custos relacionados a "Honorários Contábeis" devem ser considerados apenas se for feita a contratação desse profissional.
                        </li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Metrics Dashboard Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
              {/* Revenue Card */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-32">
                <div className="absolute right-3 top-3 bg-emerald-500/10 text-emerald-700 p-2 rounded-xl">
                  <DollarSign size={22} />
                </div>
                <div className="text-xs font-bold uppercase text-emerald-800/80 tracking-wider">Receita (Faturamento)</div>
                <div className="text-2xl font-black text-emerald-950 mt-1">
                  {currencySymbol} {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] font-bold text-emerald-700/80 mt-1 uppercase">
                  {filteredFinanceOrders.length} {filteredFinanceOrders.length === 1 ? 'Pedido no período' : 'Pedidos no período'}
                </div>
              </div>

              {/* Fixed Costs Card */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-32">
                <div className="absolute right-3 top-3 bg-amber-500/10 text-amber-700 p-2 rounded-xl">
                  <Save size={22} />
                </div>
                <div className="text-xs font-bold uppercase text-amber-800/80 tracking-wider">Custos Fixos Aplicados</div>
                <div className="text-2xl font-black text-amber-950 mt-1">
                  {currencySymbol} {appliedFixed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] font-bold text-amber-700/80 mt-1 uppercase flex items-center gap-1">
                  <span>Soma mensal: {currencySymbol} {monthlyFixedSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Variable Costs Card */}
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-32">
                <div className="absolute right-3 top-3 bg-rose-500/10 text-rose-700 p-2 rounded-xl">
                  <Trash2 size={22} />
                </div>
                <div className="text-xs font-bold uppercase text-rose-800/80 tracking-wider">Custos Variáveis</div>
                <div className="text-2xl font-black text-rose-950 mt-1">
                  {currencySymbol} {totalVariable.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] font-bold text-rose-700/80 mt-1 uppercase">
                  No período selecionado
                </div>
              </div>

              {/* Net Profit Card */}
              <div className={cn(
                "rounded-2xl p-5 shadow-md relative overflow-hidden flex flex-col justify-between h-32 border transition-all",
                netProfit >= 0 
                  ? "bg-emerald-600 border-emerald-700 text-white" 
                  : "bg-rose-600 border-rose-700 text-white"
              )}>
                <div className="absolute right-3 top-3 bg-white/20 p-2 rounded-xl">
                  <Coins size={22} />
                </div>
                <div className="text-xs font-bold uppercase tracking-wider opacity-85">LUCRO LÍQUIDO</div>
                <div className="text-2xl font-black mt-1">
                  {currencySymbol} {netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] font-bold uppercase opacity-85">
                  {netProfit >= 0 ? 'Resultado Positivo' : 'Prejuízo no período'}
                </div>
              </div>
            </div>

            {/* Split Input Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Column 1: Configuração Custos Fixos */}
              <div className="p-6 rounded-2xl space-y-4 shadow-sm border border-gray-200/50 bg-white">
                <div className="border-b border-gray-200/50 pb-2 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold font-serif text-gray-800">Custos Fixos Mensais</h2>
                    <p className="text-xs text-gray-500">Deixe em branco ou zero os que não possuir (o código irá ignorá-los).</p>
                  </div>
                </div>

                <form onSubmit={handleSaveFixedCosts} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-gray-500">Aluguel ({currencySymbol})</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 1500,00"
                        className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={fixedRentInput}
                        onChange={e => setFixedRentInput(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-gray-500">Internet ({currencySymbol})</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 100,00"
                        className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={fixedInternetInput}
                        onChange={e => setFixedInternetInput(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-gray-500">Luz ({currencySymbol})</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 250,00"
                        className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={fixedElectricityInput}
                        onChange={e => setFixedElectricityInput(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-gray-500">Água ({currencySymbol})</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 80,00"
                        className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={fixedWaterInput}
                        onChange={e => setFixedWaterInput(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-gray-500">Gás ({currencySymbol})</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 120,00"
                        className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={fixedGasInput}
                        onChange={e => setFixedGasInput(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-gray-500">Plataformas / Sistemas ({currencySymbol})</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 150,00"
                        className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={fixedSistemasInput}
                        onChange={e => setFixedSistemasInput(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-gray-500">Marketing / Tráfego ({currencySymbol})</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 300,00"
                        className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={fixedMarketingInput}
                        onChange={e => setFixedMarketingInput(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-gray-500">Contabilidade ({currencySymbol})</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 400,00"
                        className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={fixedContabilidadeInput}
                        onChange={e => setFixedContabilidadeInput(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-gray-500">Salários / Pró-labore ({currencySymbol})</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 3000,00"
                        className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={fixedSalariosInput}
                        onChange={e => setFixedSalariosInput(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-gray-500">MEI / Impostos ({currencySymbol})</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 80,00"
                        className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={fixedMeiInput}
                        onChange={e => setFixedMeiInput(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Custos Fixos Personalizados */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                      <label className="text-[10px] font-extrabold uppercase text-gray-500 tracking-wider">Custos Fixos Adicionais / Personalizados</label>
                      <button
                        type="button"
                        onClick={() => setCustomFixedCosts([...customFixedCosts, { label: '', amount: '' }])}
                        className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer"
                      >
                        <Plus size={14} /> Adicionar Custo
                      </button>
                    </div>

                    {customFixedCosts.length > 0 ? (
                      <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                        {customFixedCosts.map((item, index) => (
                          <div key={index} className="flex gap-2 items-center">
                            <input
                              type="text"
                              placeholder="Nome do custo (ex: Aluguel de Máquina, Taxas...)"
                              className="flex-grow p-2 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 outline-none focus:ring-1 focus:ring-emerald-500"
                              value={item.label}
                              onChange={e => {
                                const newCosts = [...customFixedCosts];
                                newCosts[index].label = e.target.value;
                                setCustomFixedCosts(newCosts);
                              }}
                            />
                            <div className="relative w-28 flex-shrink-0">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">{currencySymbol}</span>
                              <input
                                type="text"
                                placeholder="0,00"
                                className="w-full p-2 pl-6 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 outline-none focus:ring-1 focus:ring-emerald-500"
                                value={item.amount}
                                onChange={e => {
                                  const newCosts = [...customFixedCosts];
                                  newCosts[index].amount = e.target.value;
                                  setCustomFixedCosts(newCosts);
                                }}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setCustomFixedCosts(customFixedCosts.filter((_, idx) => idx !== index))}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0 cursor-pointer"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-400 italic">Nenhum custo fixo adicional adicionado ainda.</p>
                    )}
                  </div>

                  {/* Calculations Mode */}
                  <div className="bg-gray-100/50 p-3.5 rounded-xl border border-gray-200/80 space-y-2">
                    <div className="text-[10px] font-extrabold uppercase text-gray-600">Aplicação no Período Selecionado</div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        checked={isProportionalFixed}
                        onChange={e => setIsProportionalFixed(e.target.checked)}
                      />
                      <span className="text-xs text-gray-700 font-bold">
                        Calcular proporcionalmente aos dias do período ({daysInPeriod} dias de 30)
                      </span>
                    </label>
                    <div className="text-[10px] text-gray-500 italic mt-1 leading-normal">
                      Se desmarcado, o custo fixo integral configurado será subtraído do lucro final, independentemente de quantos dias foram selecionados no filtro.
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-3 rounded-xl font-bold shadow-md hover:scale-[1.01] transition-all cursor-pointer flex items-center justify-center gap-2 text-white"
                    style={{ backgroundColor: settings.primaryColor || '#865d39' }}
                  >
                    <Save size={18} /> Salvar Custos Fixos
                  </button>
                </form>
              </div>

              {/* Column 2: Custos Variáveis */}
              <div className="p-6 rounded-2xl space-y-4 shadow-sm border border-gray-200/50 bg-white flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="border-b border-gray-200/50 pb-2">
                    <h2 className="text-lg font-bold font-serif text-gray-800">
                      {isEditingVarCost ? 'Editar Custo Variável' : 'Lançar Custo Variável (Mercado, etc)'}
                    </h2>
                    <p className="text-xs text-gray-500">Adicione compras pontuais de ingredientes, embalagens e mercado.</p>
                  </div>

                  <form onSubmit={handleAddVarCost} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-[10px] font-bold uppercase text-gray-500">Descrição do Custo</label>
                        <input 
                          type="text" 
                          placeholder="Ex: Compra de carne e temperos no atacadão"
                          className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-emerald-500"
                          value={newVarCost.description || ''}
                          onChange={e => setNewVarCost({...newVarCost, description: e.target.value})}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500">Valor ({currencySymbol})</label>
                        <input 
                          type="text" 
                          placeholder="0,00"
                          className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-emerald-500"
                          value={varCostAmountInput}
                          onChange={e => setVarCostAmountInput(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500">Data do Gasto</label>
                        <input 
                          type="date" 
                          className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-emerald-500"
                          value={newVarCost.date || ''}
                          onChange={e => setNewVarCost({...newVarCost, date: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        type="submit"
                        className="flex-grow py-3 rounded-xl font-bold shadow-md hover:scale-[1.01] transition-all cursor-pointer flex items-center justify-center gap-2 bg-gray-800 text-white"
                      >
                        {isEditingVarCost ? <Save size={18} /> : <Plus size={18} />}
                        {isEditingVarCost ? 'Salvar Edição' : 'Lançar Gasto'}
                      </button>
                      {isEditingVarCost && (
                        <button 
                          type="button"
                          onClick={() => {
                            setIsEditingVarCost(null);
                            setNewVarCost({ description: '', amount: 0, date: new Date().toISOString().split('T')[0] });
                            setVarCostAmountInput('');
                          }}
                          className="px-4 py-3 rounded-xl font-bold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all cursor-pointer text-xs"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* Sub-section: List of Variable Costs */}
                <div className="space-y-2 mt-6 pt-6 border-t border-gray-200/50">
                  <div className="text-[10px] font-extrabold uppercase text-gray-500 mb-2">
                    Gastos Variáveis Registrados no Período
                  </div>
                  
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {variableCosts
                      .filter(vc => {
                        if (!vc.date) return false;
                        const vcDate = new Date(vc.date + 'T12:00:00');
                        const start = financeStartDate ? new Date(financeStartDate + 'T00:00:00') : null;
                        const end = financeEndDate ? new Date(financeEndDate + 'T23:59:59') : null;
                        if (start && vcDate < start) return false;
                        if (end && vcDate > end) return false;
                        return true;
                      })
                      .sort((a,b) => b.date.localeCompare(a.date))
                      .map(vc => (
                        <div key={vc.id} className="bg-white/75 border border-gray-200 p-3 rounded-xl flex items-center justify-between group">
                          <div>
                            <div className="font-bold text-xs text-gray-800">{vc.description}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5 font-semibold flex items-center gap-2">
                              <span>{new Date(vc.date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                              <span>•</span>
                              <span className="text-rose-600 font-bold">{currencySymbol} {vc.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => {
                                setIsEditingVarCost(vc);
                                setNewVarCost(vc);
                                setVarCostAmountInput(vc.amount.toString());
                                scrollToTop();
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-all"
                              title="Editar"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={() => handleDeleteVarCost(vc.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-all"
                              title="Excluir"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    
                    {variableCosts.filter(vc => {
                      if (!vc.date) return false;
                      const vcDate = new Date(vc.date + 'T12:00:00');
                      const start = financeStartDate ? new Date(financeStartDate + 'T00:00:00') : null;
                      const end = financeEndDate ? new Date(financeEndDate + 'T23:59:59') : null;
                      if (start && vcDate < start) return false;
                      if (end && vcDate > end) return false;
                      return true;
                    }).length === 0 && (
                      <div className="text-center py-6 text-xs text-gray-400 font-medium italic">
                        Nenhum custo variável lançado neste período.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
          </div>
        )}

        {activeTab === 'galleries' && (
          <div className="max-w-5xl space-y-8 pb-10">
            <div className="flex items-center justify-between border-b border-gray-200/50 pb-4">
              <div>
                <h1 className="text-3xl font-serif font-black" style={{ color: settings.primaryColor || '#865d39' }}>Galerias de Imagem</h1>
                <p className="text-sm text-black font-semibold opacity-100" style={{ color: '#000000' }}>Crie e gerencie até 6 galerias com 6 fotos cada para exibir como referências de estilo para bolos personalizados.</p>
              </div>
              <div>
                <button
                  type="button"
                  disabled={galleries.length >= 6}
                  onClick={async () => {
                    if (galleries.length >= 6) {
                      toast.error("O limite é de no máximo 6 galerias!");
                      return;
                    }
                    try {
                      await addDoc(collection(db, "galerias"), {
                        name: `Galeria ${galleries.length + 1}`,
                        images: ["", "", "", "", "", ""]
                      });
                      toast.success("Galeria criada com sucesso!");
                    } catch (e) {
                      toast.error("Erro ao criar galeria.");
                    }
                  }}
                className={cn(
                    "flex items-center gap-1.5 py-4 px-6 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow border-0",
                    galleries.length >= 6 ? "bg-gray-400 text-white cursor-not-allowed" : "hover:scale-[1.02] cursor-pointer"
                  )}
                  style={galleries.length >= 6 ? {} : { 
                    backgroundColor: settings.primaryColor || '#865d39',
                    color: getContrastText(settings.primaryColor || '#865d39')
                  }}
                >
                  <Plus size={16} /> Criar Nova Galeria ({galleries.length}/6)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {galleries.map((gallery) => (
                <div key={gallery.id} className="glass p-6 rounded-3xl space-y-4 relative flex flex-col justify-between">
                  <div>
                    {/* Gallery Title Input and Delete Button */}
                    <div className="flex items-center justify-between gap-3 border-b border-black/10 pb-3 mb-2">
                      <input
                        type="text"
                        value={gallery.name}
                        onChange={async (e) => {
                          const val = e.target.value;
                          await updateDoc(doc(db, "galerias", gallery.id), {
                            name: val
                          });
                        }}
                        className="font-serif font-black text-lg bg-transparent border-b border-transparent hover:border-black/20 focus:border-black/50 focus:outline-none transition-all w-3/4 pb-0.5 text-black"
                        placeholder="Nome da Galeria"
                      />
                      {galleryIdToDelete === gallery.id ? (
                        <div className="flex items-center gap-1.5 animate-fade-in">
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await deleteDoc(doc(db, "galerias", gallery.id));
                                toast.success("Galeria removida com sucesso!");
                                setGalleryIdToDelete(null);
                              } catch (e) {
                                toast.error("Erro ao remover galeria.");
                              }
                            }}
                            className="px-2 py-1 text-xs text-white rounded-lg font-bold transition-all border-0 cursor-pointer shadow-sm"
                            style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
                          >
                            Excluir
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setGalleryIdToDelete(null);
                            }}
                            className="px-2 py-1 text-xs text-black bg-gray-200 hover:bg-gray-300 rounded-lg font-bold transition-all border-0 cursor-pointer"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setGalleryIdToDelete(gallery.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors font-medium border-0 cursor-pointer"
                          title="Excluir Galeria"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    {/* Image uploads grid - 6 separate slots */}
                    <div className="bg-white/60 border border-white/30 rounded-2xl p-3 mt-2 shadow-sm">
                      <p className="text-[11px] font-bold text-gray-950 leading-relaxed text-center">
                        Gerencie as 6 imagens da galeria de forma independente abaixo. Clique em um espaço para fazer upload ou apague para remover.
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-3.5 mt-3">
                      {[0, 1, 2, 3, 4, 5].map((index) => {
                        const currentImg = gallery.images?.[index] || "";
                        return (
                          <div key={index} className="flex flex-col items-center gap-1.5">
                            <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-white/40 border border-black/10 flex items-center justify-center group shadow-sm">
                              {currentImg ? (
                                <>
                                  <img
                                    src={currentImg}
                                    alt={`Slot ${index + 1}`}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-1.5 p-1">
                                    {/* Edit Upload */}
                                    <label className="p-1.5 bg-white text-gray-800 rounded-full cursor-pointer hover:scale-105 shadow hover:text-black">
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          handleFileChange(e, async (b64) => {
                                            const updatedImages = [...(gallery.images || ["", "", "", "", "", ""])];
                                            updatedImages[index] = b64;
                                            await updateDoc(doc(db, "galerias", gallery.id), {
                                              images: updatedImages
                                            });
                                            toast.success(`Foto ${index + 1} alterada com sucesso!`);
                                          }, true);
                                        }}
                                      />
                                      <Edit2 size={12} />
                                    </label>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const updatedImages = [...(gallery.images || ["", "", "", "", "", ""])];
                                        updatedImages[index] = "";
                                        await updateDoc(doc(db, "galerias", gallery.id), {
                                          images: updatedImages
                                        });
                                        toast.success(`Foto ${index + 1} removida!`);
                                      }}
                                      className="p-1.5 bg-red-500 text-white rounded-full hover:scale-105 shadow border-0 cursor-pointer"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-white/50 transition-colors p-2 text-center text-gray-500 hover:text-black select-none">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      handleFileChange(e, async (b64) => {
                                        const updatedImages = [...(gallery.images || ["", "", "", "", "", ""])];
                                        updatedImages[index] = b64;
                                        await updateDoc(doc(db, "galerias", gallery.id), {
                                          images: updatedImages
                                        });
                                        toast.success(`Foto ${index + 1} adicionada com sucesso!`);
                                      }, true);
                                    }}
                                  />
                                  <Plus size={16} className="text-gray-400" />
                                  <span className="text-[9px] font-black uppercase tracking-wider mt-1 opacity-60">Enviar</span>
                                </label>
                              )}
                            </div>
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-black/60">Foto {index + 1}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}

              {galleries.length === 0 && (
                <div className="md:col-span-2 glass p-10 rounded-3xl text-center space-y-3">
                  <div className="w-12 h-12 bg-black/5 rounded-full flex items-center justify-center mx-auto text-gray-400">
                    <ImageIcon size={24} />
                  </div>
                  <div>
                    <h3 className="font-serif font-black text-lg text-black">Nenhuma galeria criada</h3>
                    <p className="text-xs font-semibold text-gray-500 max-w-sm mx-auto leading-normal">Comece criando uma nova galeria de fotos separadas acima e vincule-a nos seus bolos personalizados!</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'cakeOptions' && (
          <div className="max-w-4xl space-y-8 pb-10">
            <div className="flex items-center justify-between border-b border-gray-200/50 pb-4">
              <div>
                <h1 className="text-3xl font-serif font-black" style={{ color: settings.primaryColor || '#865d39' }}>Opções de Bolos</h1>
                <p className="text-sm text-black font-semibold opacity-100" style={{ color: '#000000' }}>Gerencie tamanhos, massas, recheios, coberturas e topos de bolo que poderão ser customizados pelo cliente.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* TAMANHOS */}
              <div className="glass p-6 rounded-3xl space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-black/10">
                  <h3 className="text-sm font-serif font-extrabold uppercase tracking-widest text-[#000000]" style={{ color: '#000000' }}>Tamanhos / Fatias / Peso</h3>
                  <button 
                    onClick={() => addCakeOptionItem('cakeSizes', '')}
                    className="p-1.5 rounded-full bg-blue-500 text-white hover:bg-blue-600 active:scale-95 transition-transform cursor-pointer"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="space-y-2 max-h-62 overflow-y-auto pr-1">
                  {(settings.cakeSizes || []).length === 0 ? (
                    <p className="text-xs text-black font-semibold italic py-2" style={{ color: '#000000' }}>Nenhum tamanho adicionado.</p>
                  ) : (
                    (settings.cakeSizes || []).map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input 
                          type="text"
                          value={item}
                          placeholder="Ex: Aro 20cm - 20 fatias - 1,5 kg"
                          onChange={(e) => updateCakeOptionItem('cakeSizes', idx, e.target.value)}
                          className="flex-grow bg-white/60 border border-gray-200 py-2.5 px-4 rounded-xl text-sm"
                        />
                        <button 
                          onClick={() => removeCakeOptionItem('cakeSizes', idx)}
                          className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 active:scale-95 transition-transform"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* MASSAS */}
              <div className="glass p-6 rounded-3xl space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-black/10">
                  <h3 className="text-sm font-serif font-extrabold uppercase tracking-widest text-[#000000]" style={{ color: '#000000' }}>Tipos de Massa</h3>
                  <button 
                    onClick={() => addCakeOptionItem('cakeDoughs', '')}
                    className="p-1.5 rounded-full bg-blue-500 text-white hover:bg-blue-600 active:scale-95 transition-transform cursor-pointer"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="space-y-2 max-h-62 overflow-y-auto pr-1">
                  {(settings.cakeDoughs || []).length === 0 ? (
                    <p className="text-xs text-black font-semibold italic py-2" style={{ color: '#000000' }}>Nenhuma massa adicionada.</p>
                  ) : (
                    (settings.cakeDoughs || []).map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input 
                          type="text"
                          value={item}
                          placeholder="Ex: Chocolate, Branca, Mesclado"
                          onChange={(e) => updateCakeOptionItem('cakeDoughs', idx, e.target.value)}
                          className="flex-grow bg-white/60 border border-gray-200 py-2.5 px-4 rounded-xl text-sm"
                        />
                        <button 
                          onClick={() => removeCakeOptionItem('cakeDoughs', idx)}
                          className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 active:scale-95 transition-transform"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* RECHEIOS */}
              <div className="glass p-6 rounded-3xl space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-black/10">
                  <div className="space-y-1">
                    <h3 className="text-sm font-serif font-extrabold uppercase tracking-widest text-[#000000]" style={{ color: '#000000' }}>Recheios</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-black font-extrabold" style={{ color: '#000000' }}>Máximo de opções:</span>
                      <input 
                        type="number"
                        min="1"
                        max="10"
                        value={settings.cakeFillingsMax || 2}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 1);
                          setSettings(prev => ({ ...prev, cakeFillingsMax: val }));
                        }}
                        className="w-16 bg-white/60 border border-gray-200 py-1 px-2 rounded-lg text-sm text-center font-bold"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={() => addCakeOptionItem('cakeFillings', '')}
                    className="p-1.5 rounded-full bg-blue-500 text-white hover:bg-blue-600 active:scale-95 transition-transform cursor-pointer"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="space-y-2 max-h-62 overflow-y-auto pr-1">
                  {(settings.cakeFillings || []).length === 0 ? (
                    <p className="text-xs text-black font-semibold italic py-2" style={{ color: '#000000' }}>Nenhum recheio adicionado.</p>
                  ) : (
                    (settings.cakeFillings || []).map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input 
                          type="text"
                          value={item}
                          placeholder="Ex: Chocolate, Morango, Cereja, Abacaxi"
                          onChange={(e) => updateCakeOptionItem('cakeFillings', idx, e.target.value)}
                          className="flex-grow bg-white/60 border border-gray-200 py-2.5 px-4 rounded-xl text-sm"
                        />
                        <button 
                          onClick={() => removeCakeOptionItem('cakeFillings', idx)}
                          className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 active:scale-95 transition-transform"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* COBERTURAS */}
              <div className="glass p-6 rounded-3xl space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-black/10">
                  <h3 className="text-sm font-serif font-extrabold uppercase tracking-widest text-[#000000]" style={{ color: '#000000' }}>Coberturas</h3>
                  <button 
                    onClick={() => addCakeOptionItem('cakeToppings', '')}
                    className="p-1.5 rounded-full bg-blue-500 text-white hover:bg-blue-600 active:scale-95 transition-transform cursor-pointer"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="space-y-2 max-h-62 overflow-y-auto pr-1">
                  {(settings.cakeToppings || []).length === 0 ? (
                    <p className="text-xs text-black font-semibold italic py-2" style={{ color: '#000000' }}>Nenhuma cobertura adicionada.</p>
                  ) : (
                    (settings.cakeToppings || []).map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input 
                          type="text"
                          value={item}
                          placeholder="Ex: Chocolate, Chantilly"
                          onChange={(e) => updateCakeOptionItem('cakeToppings', idx, e.target.value)}
                          className="flex-grow bg-white/60 border border-gray-200 py-2.5 px-4 rounded-xl text-sm"
                        />
                        <button 
                          onClick={() => removeCakeOptionItem('cakeToppings', idx)}
                          className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 active:scale-95 transition-transform"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* TOPO DO BOLO */}
              <div className="glass p-6 rounded-3xl space-y-4 md:col-span-2">
                <div className="flex justify-between items-center pb-2 border-b border-black/10">
                  <h3 className="text-sm font-serif font-extrabold uppercase tracking-widest text-[#000000]" style={{ color: '#000000' }}>Topo do Bolo</h3>
                  <button 
                    onClick={() => addCakeOptionItem('cakeToppers', '')}
                    className="p-1.5 rounded-full bg-blue-500 text-white hover:bg-blue-600 active:scale-95 transition-transform cursor-pointer"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="space-y-2 max-h-62 overflow-y-auto pr-1">
                  {(settings.cakeToppers || []).length === 0 ? (
                    <p className="text-xs text-black font-semibold italic py-2" style={{ color: '#000000' }}>Nenhum topo de bolo adicionado.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {(settings.cakeToppers || []).map((item, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input 
                            type="text"
                            value={item}
                            placeholder="Ex: Flores, Plaquinha com Nome"
                            onChange={(e) => updateCakeOptionItem('cakeToppers', idx, e.target.value)}
                            className="flex-grow bg-white/60 border border-gray-200 py-2.5 px-4 rounded-xl text-sm"
                          />
                          <button 
                            onClick={() => removeCakeOptionItem('cakeToppers', idx)}
                            className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 active:scale-95 transition-transform"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={saveSettings}
                disabled={isSaving}
                className="flex items-center gap-2 px-8 py-4 font-extrabold rounded-2xl shadow-xl transition-all active:scale-[0.98] select-none hover:shadow-2xl cursor-pointer disabled:opacity-50"
                style={{ 
                  backgroundColor: settings.primaryColor || '#865d39',
                  color: getContrastText(settings.primaryColor || '#865d39')
                }}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    <span>Salvar Opções de Bolos</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-3xl space-y-8 pb-10">
            <h2 className="text-3xl font-serif font-bold">Configure seu app</h2>
            
            <div className="glass p-6 rounded-2xl space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Logotipo da Loja</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-white p-1 border border-gray-200 flex items-center justify-center overflow-hidden shadow-sm">
                      <img src={settings?.logo} alt="Pré-visualização" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <input 
                        type="file" 
                        id="logo-upload"
                        accept="image/*"
                        onChange={e => handleFileChange(e, (b64) => setSettings({...settings, logo: b64}), 'logo')}
                        className="hidden"
                      />
                      <div className="flex gap-2">
                        <label 
                          htmlFor="logo-upload"
                          className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold cursor-pointer hover:bg-gray-50 transition-colors text-black"
                        >
                          Selecionar Imagem
                        </label>
                        <button
                          type="button"
                          onClick={() => setSettings({...settings, logo: 'https://i.ibb.co/SXRBhD32/dende.png'})}
                          className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                        >
                          Remover Logo
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Cor Primária</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="color" 
                      value={settings?.primaryColor || '#865d39'}
                      onChange={e => setSettings({...settings, primaryColor: e.target.value})}
                      className="w-12 h-12 p-1 rounded-lg cursor-pointer border border-gray-200"
                    />
                    <input 
                      type="text" 
                      className="flex-grow p-3 rounded-xl border border-gray-300 font-mono text-sm bg-white/50"
                      value={settings?.primaryColor || ''}
                      onChange={e => setSettings({...settings, primaryColor: e.target.value})}
                      placeholder="#000000"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Cor do Efeito Glass</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="color" 
                      value={settings?.glassColor?.startsWith('#') ? settings.glassColor : '#ffffff'}
                      onChange={e => setSettings(prev => ({...prev, glassColor: e.target.value}))}
                      className="w-12 h-12 p-1 rounded-lg cursor-pointer border border-gray-200"
                    />
                    <input 
                      type="text" 
                      className="flex-grow p-3 rounded-xl border border-gray-300 font-mono text-sm bg-white/50"
                      value={settings?.glassColor || ''}
                      onChange={e => setSettings(prev => ({...prev, glassColor: e.target.value}))}
                      placeholder="Ex: rgba(255, 255, 255, 0.4)"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Cor da Fonte (Textos)</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="color" 
                      value={settings?.textColor || '#000000'}
                      onChange={e => setSettings({...settings, textColor: e.target.value})}
                      className="w-12 h-12 p-1 rounded-lg cursor-pointer border border-gray-200"
                    />
                    <input 
                      type="text" 
                      className="flex-grow p-3 rounded-xl border border-gray-300 font-mono text-sm bg-white/50 text-black"
                      value={settings?.textColor || ''}
                      onChange={e => setSettings({...settings, textColor: e.target.value})}
                      placeholder="#000000"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Cor da Fonte (Categorias)</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="color" 
                      value={settings?.categoryTextColor || '#000000'}
                      onChange={e => setSettings({...settings, categoryTextColor: e.target.value})}
                      className="w-12 h-12 p-1 rounded-lg cursor-pointer border border-gray-200"
                    />
                    <input 
                      type="text" 
                      className="flex-grow p-3 rounded-xl border border-gray-300 font-mono text-sm bg-white/50 text-black"
                      value={settings?.categoryTextColor || ''}
                      onChange={e => setSettings({...settings, categoryTextColor: e.target.value})}
                      placeholder="#000000"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Slogan do App</label>
                  <textarea 
                    rows={2}
                    className="w-full p-3 rounded-xl border border-gray-300"
                    value={settings?.slogan || ''}
                    onChange={e => setSettings({...settings, slogan: e.target.value})}
                    placeholder="Ex: O sabor que você merece..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Mensagem Final WhatsApp</label>
                  <textarea 
                    rows={2}
                    className="w-full p-3 rounded-xl border border-gray-300"
                    value={settings?.whatsappClosingMessage || ''}
                    onChange={e => setSettings({...settings, whatsappClosingMessage: e.target.value})}
                    placeholder="Ex: Obrigada pelo pedido..."
                  />
                </div>
              </div>



              <div className="space-y-2">
                <label className="text-sm font-bold uppercase opacity-60">Imagem de Fundo do App</label>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-32 h-20 rounded-xl bg-white border border-gray-200 flex items-center justify-center overflow-hidden shadow-sm">
                      {settings?.backgroundImage ? (
                        <img 
                          key={settings.backgroundImage}
                          src={settings.backgroundImage} 
                          alt="Pré-visualização do Fundo" 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer" 
                        />
                      ) : (
                        <div className="text-[10px] text-gray-400 font-bold uppercase">Sem fundo</div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <input 
                        type="file" 
                        id="bg-upload"
                        accept="image/*"
                        onChange={e => handleFileChange(e, (b64) => setSettings(prev => ({...prev, backgroundImage: b64})), 'background')}
                        className="hidden"
                      />
                      <label 
                        htmlFor="bg-upload"
                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold cursor-pointer hover:bg-gray-50 transition-colors text-black"
                      >
                        Enviar Imagem
                      </label>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase opacity-40">Ou cole o link da imagem direta</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 text-sm"
                      value={settings?.backgroundImage?.startsWith('data:image/') ? '' : (settings?.backgroundImage || '')}
                      onChange={e => setSettings(prev => ({...prev, backgroundImage: e.target.value}))}
                      placeholder="https://exemplo.com/imagem.jpg"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Nome da Marca</label>
                  <input 
                    type="text" 
                    className="w-full p-3 rounded-xl border border-gray-300"
                    value={settings?.brandName || ''}
                    onChange={e => handleBrandNameChange(e.target.value)}
                    placeholder="Ex: Lu das marmitas"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Slug da Loja (URL)</label>
                  <input 
                    type="text" 
                    className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50"
                    value={settings?.slug || ''}
                    onChange={e => setSettings({...settings, slug: slugify(e.target.value)})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">WhatsApp</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select 
                      className="p-3 rounded-xl border border-gray-300 bg-white font-bold w-full sm:w-auto"
                      value={settings?.whatsappCountryCode || '+55'}
                      onChange={e => setSettings({...settings, whatsappCountryCode: e.target.value})}
                    >
                      <option value="+55">+55 (BR)</option>
                    </select>
                    <input 
                      type="text" 
                      className="flex-grow p-3 rounded-xl border border-gray-300 w-full bg-white text-black font-semibold"
                      value={formatBRPhone(settings?.whatsappNumber || '')}
                      onChange={e => setSettings({...settings, whatsappNumber: formatBRPhone(e.target.value)})}
                      placeholder="(99) 99999-9999"
                    />
                  </div>
                  {settings?.whatsappNumber && settings.whatsappNumber.replace(/\D/g, '').length < 11 && (
                    <p className="text-xs text-amber-600 font-semibold mt-1">
                      ⚠️ Atenção: O número digitado tem menos de 11 dígitos. Verifique se não está faltando o DDD ou o último dígito (por exemplo, o último número que você cadastrou no checkout).
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Senha do Painel Adm</label>
                  <input 
                    type="text" 
                    className="w-full p-3 rounded-xl border border-gray-300"
                    value={settings?.adminPassword || ''}
                    onChange={e => setSettings({...settings, adminPassword: e.target.value})}
                    placeholder="admin123"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h3 className="text-xl font-serif font-bold">Idioma e Finalização do Pedido</h3>
                
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Título da Finalização (Abaixo de "Detalhes do Pedido")</label>
                  <textarea 
                    rows={2}
                    className="w-full p-3 rounded-xl border border-gray-300"
                    value={settings?.checkoutTitle || ''}
                    onChange={e => setSettings({...settings, checkoutTitle: e.target.value})}
                    placeholder="Ex: Ficamos muito felizes com seu pedido!..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3 p-4 bg-white/50 rounded-2xl border border-gray-100">
                    <label className="text-xs font-bold uppercase opacity-60">Bloco Informativo 1</label>
                    <input 
                      type="text" 
                      className="w-full p-2 rounded-lg border border-gray-200 text-sm font-bold"
                      value={settings?.infoBlock1Title || ''}
                      onChange={e => setSettings({...settings, infoBlock1Title: e.target.value})}
                      placeholder="Título (Ex: CONFIRMAÇÃO DO PEDIDO)"
                    />
                    <textarea 
                      rows={3}
                      className="w-full p-2 rounded-lg border border-gray-200 text-sm"
                      value={settings?.infoBlock1Text || ''}
                      onChange={e => setSettings({...settings, infoBlock1Text: e.target.value})}
                      placeholder="Texto informativo..."
                    />
                  </div>
                  <div className="space-y-3 p-4 bg-white/50 rounded-2xl border border-gray-100">
                    <label className="text-xs font-bold uppercase opacity-60">Bloco Informativo 2</label>
                    <input 
                      type="text" 
                      className="w-full p-2 rounded-lg border border-gray-200 text-sm font-bold"
                      value={settings?.infoBlock2Title || ''}
                      onChange={e => setSettings({...settings, infoBlock2Title: e.target.value})}
                      placeholder="Título (Ex: RETIRADA NO LOCAL)"
                    />
                    <textarea 
                      rows={3}
                      className="w-full p-2 rounded-lg border border-gray-200 text-sm"
                      value={settings?.infoBlock2Text || ''}
                      onChange={e => setSettings({...settings, infoBlock2Text: e.target.value})}
                      placeholder="Texto informativo..."
                    />
                  </div>
                </div>

                {/* VALOR MÍNIMO PARA PEDIDO (R$) */}
                <div className="p-5 rounded-2xl bg-[#eef8f1] border border-[#c3e6cb] space-y-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-[#00753A] flex items-center justify-center text-white shrink-0 shadow-sm">
                      <Truck size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-serif font-black text-base text-gray-900">
                        Valor Mínimo para Pedido (R$)
                      </h4>
                      <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                        Trava que impede o cliente de avançar para a conclusão caso o valor somado dos produtos seja inferior a este valor (padrão: R$ 100,00). O cliente é avisado no carrinho e no checkout sobre o valor mínimo necessário.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                    <div className="relative flex-1 max-w-xs">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-emerald-800 text-sm">
                        R$
                      </span>
                      <input
                        type="text"
                        value={minOrderInput}
                        onChange={handleMinOrderChange}
                        placeholder="100,00"
                        className="w-full p-3 pl-11 rounded-xl border border-emerald-300 bg-white text-base font-black text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none shadow-xs"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveMinOrder}
                      className="px-6 py-3 rounded-xl bg-[#00753A] hover:bg-[#00602f] active:scale-95 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Save size={16} />
                      <span>SALVAR VALOR MÍNIMO</span>
                    </button>

                    {(settings?.minOrderValue ?? 0) > 0 ? (
                      <div className="px-4 py-3 rounded-xl bg-[#d1f2dd] border border-[#a3e4bb] text-[#00602f] text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                        <Check size={15} className="text-[#00602f] stroke-[3]" />
                        <span>Trava Ativa: R$ {(settings.minOrderValue || 0).toFixed(2).replace('.', ',')}</span>
                      </div>
                    ) : (
                      <div className="px-4 py-3 rounded-xl bg-gray-100 border border-gray-300 text-gray-600 text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                        <span>Sem trava ativa (Livre)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* CONFIGURAÇÃO DA MENSAGEM DE ANIVERSÁRIO (WHATSAPP) */}
              <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200/80 shadow-sm space-y-4 text-gray-900">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-pink-100 text-pink-600 border border-pink-200 shadow-2xs">
                    <Cake size={22} className="stroke-[2.2]" />
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-lg text-gray-900">Mensagem Padrão de Aniversário (WhatsApp)</h4>
                    <p className="text-xs text-gray-500">Personalize o texto que será enviado automaticamente aos aniversariantes na aba Clientes.</p>
                  </div>
                </div>

                <div className="space-y-3.5 pt-1">
                  <div className="p-3.5 bg-pink-50/70 border border-pink-200/80 rounded-2xl space-y-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-pink-900 block">
                      Abertura da Mensagem (Fixa com o Nome do Cliente):
                    </span>
                    <div className="font-mono text-xs text-pink-950 font-bold bg-white p-2.5 rounded-xl border border-pink-200 shadow-2xs">
                      Parabéns, {"{Nome do Cliente}"}! 🎉
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-700">
                        Texto da Mensagem de Parabéns
                      </label>
                      <span className="text-[11px] text-gray-500 font-medium">
                        Tag disponível: <strong className="text-pink-600">{"{empresa}"}</strong>
                      </span>
                    </div>
                    <textarea 
                      rows={4}
                      className="w-full p-3.5 rounded-2xl border border-gray-300 text-sm bg-white text-gray-900 font-normal leading-relaxed focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 outline-none transition-all"
                      value={settings?.birthdayMessageTemplate ?? 'A equipe da {empresa} te deseja um feliz aniversário! Que o seu dia seja repleto de realizações, saúde, sucesso e momentos doces. Como nosso presente para comemorar seu dia, preparamos uma oferta especial com surpresa no seu próximo pedido! 🎂🎁'}
                      onChange={e => setSettings({...settings, birthdayMessageTemplate: e.target.value})}
                      placeholder="Escreva a mensagem personalizada para os aniversariantes..."
                    />
                  </div>

                  {/* Prévia da Mensagem */}
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                      <MessageCircle size={13} className="text-emerald-600" /> Prévia da mensagem no WhatsApp do cliente:
                    </span>
                    <p className="text-xs text-gray-800 italic bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs leading-relaxed">
                      "Parabéns, Patrícia Guimarães! 🎉 {(settings?.birthdayMessageTemplate ?? 'A equipe da {empresa} te deseja um feliz aniversário! Que o seu dia seja repleto de realizações, saúde, sucesso e momentos doces. Como nosso presente para comemorar seu dia, preparamos uma oferta especial com surpresa no seu próximo pedido! 🎂🎁').replace(/\{nome\}/gi, 'Patrícia Guimarães').replace(/\{empresa\}/gi, settings?.brandName || 'nossa equipe')}"
                    </p>
                  </div>
                </div>
              </div>

              {/* CONFIGURAÇÃO DOS BOTÕES DE INSTRUÇÕES (CARDÁPIO DO CLIENTE) */}
              <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200/80 shadow-sm space-y-5 text-gray-900">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-2xs">
                    <HelpCircle size={22} className="stroke-[2.2]" />
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-lg text-gray-900">Botões e Guias Informativos no Cardápio</h4>
                    <p className="text-xs text-gray-500">Controle quais botões flutuantes de instruções e manuais de consumo aparecem para o cliente no final do cardápio.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* Toggle: INSTRUÇÕES KIT DETOX */}
                  <div 
                    className="p-4 rounded-2xl border-2 transition-all bg-white flex flex-col justify-between gap-3 shadow-xs"
                    style={{ borderColor: settings?.showDetoxInstructionsButton !== false ? '#4b6757' : '#e5e7eb' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#4b6757] text-white flex items-center justify-center text-xs font-bold shrink-0">
                            <Leaf size={13} />
                          </div>
                          <span className="text-xs font-bold uppercase tracking-wider text-[#4b6757]">
                            Botão "INSTRUÇÕES KIT DETOX"
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed font-medium">
                          Abre o guia com orientações de armazenamento, consumo diário e a tabela de substituições de refeições e sucos.
                        </p>
                      </div>
                      
                      <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={settings?.showDetoxInstructionsButton !== false}
                          onChange={e => setSettings({...settings, showDetoxInstructionsButton: e.target.checked})}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4b6757]"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px]">
                      <span className={cn(
                        "font-bold uppercase tracking-wider px-2 py-0.5 rounded-md text-[10px]",
                        settings?.showDetoxInstructionsButton !== false
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-gray-100 text-gray-500"
                      )}>
                        {settings?.showDetoxInstructionsButton !== false ? '● Ativo no link do cliente' : '○ Oculto no link do cliente'}
                      </span>
                    </div>
                  </div>

                  {/* Toggle: COMO ARMAZENAR E COMO AQUECER */}
                  <div 
                    className="p-4 rounded-2xl border-2 transition-all bg-white flex flex-col justify-between gap-3 shadow-xs"
                    style={{ borderColor: settings?.showStorageInstructionsButton !== false ? '#725b81' : '#e5e7eb' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#725b81] text-white flex items-center justify-center text-xs font-bold shrink-0">
                            <Utensils size={13} />
                          </div>
                          <span className="text-xs font-bold uppercase tracking-wider text-[#725b81]">
                            Botão "COMO ARMAZENAR E COMO AQUECER"
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed font-medium">
                          Abre o guia com dicas de conservação no freezer, descongelamento e tempo de aquecimento no micro-ondas/banho-maria.
                        </p>
                      </div>
                      
                      <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={settings?.showStorageInstructionsButton !== false}
                          onChange={e => setSettings({...settings, showStorageInstructionsButton: e.target.checked})}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#725b81]"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px]">
                      <span className={cn(
                        "font-bold uppercase tracking-wider px-2 py-0.5 rounded-md text-[10px]",
                        settings?.showStorageInstructionsButton !== false
                          ? "bg-purple-100 text-purple-800"
                          : "bg-gray-100 text-gray-500"
                      )}>
                        {settings?.showStorageInstructionsButton !== false ? '● Ativo no link do cliente' : '○ Oculto no link do cliente'}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-gray-100 space-y-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block">
                        Imagem do Pop-up (Como Armazenar e Como Aquecer):
                      </label>
                      <div className="flex items-center gap-3">
                        <img 
                          src={settings?.storageInstructionsImage || "https://i.ibb.co/TxBv7fMY/Gemini-Generated-Image-j316rpj316rpj316.jpg"} 
                          alt="Prévia instruções" 
                          className="w-12 h-12 rounded-lg object-cover border border-gray-200 shadow-sm shrink-0 bg-gray-50"
                          referrerPolicy="no-referrer"
                        />
                        <input 
                          type="url" 
                          placeholder="URL da Imagem (Ex: https://i.ibb.co/...)"
                          className="flex-grow p-2 text-xs rounded-xl border border-gray-300 bg-white"
                          value={settings?.storageInstructionsImage || ''}
                          onChange={e => setSettings({ ...settings, storageInstructionsImage: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Toggle: DIETA PERSONALIZADA */}
                  <div 
                    className="p-4 rounded-2xl border-2 transition-all bg-white flex flex-col justify-between gap-3 shadow-xs"
                    style={{ borderColor: settings?.showCustomDietButton !== false ? '#00753A' : '#e5e7eb' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#00753A] text-white flex items-center justify-center text-xs font-bold shrink-0">
                            <Sparkles size={13} />
                          </div>
                          <span className="text-xs font-bold uppercase tracking-wider text-[#00753A]">
                            Botão "DIETA PERSONALIZADA"
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed font-medium">
                          Exibe a tag verde (#00753A) com balão de dúvida que abre o pop-up "Sua dieta do seu jeito!" e direciona para o WhatsApp com a mensagem personalizada.
                        </p>
                      </div>
                      
                      <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={settings?.showCustomDietButton !== false}
                          onChange={e => setSettings({...settings, showCustomDietButton: e.target.checked})}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00753A]"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px]">
                      <span className={cn(
                        "font-bold uppercase tracking-wider px-2 py-0.5 rounded-md text-[10px]",
                        settings?.showCustomDietButton !== false
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-gray-100 text-gray-500"
                      )}>
                        {settings?.showCustomDietButton !== false ? '● Ativo no link do cliente' : '○ Oculto no link do cliente'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CONFIGURAÇÃO DA TELA DE BOAS VINDAS (TELA 1) */}
              <div className="glass p-6 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif font-bold text-lg text-black">Tela de Boas-Vindas (Apresentação)</h4>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={settings?.introEnabled !== false}
                      onChange={e => setSettings({...settings, introEnabled: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ml-2 text-xs font-bold uppercase opacity-65 text-black">Ativada</span>
                  </label>
                </div>
                
                {settings?.introEnabled !== false && (
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase opacity-50 text-black">Título Principal</label>
                        <input 
                          type="text" 
                          className="w-full p-2.5 rounded-xl border border-gray-300 text-sm bg-white"
                          value={settings?.introTitle || ''}
                          onChange={e => setSettings({...settings, introTitle: e.target.value})}
                          placeholder="Ex: Escola de gastronomia"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase opacity-50 text-black">Texto do Botão</label>
                        <input 
                          type="text" 
                          className="w-full p-2.5 rounded-xl border border-gray-300 text-sm bg-white"
                          value={settings?.introButtonText || ''}
                          onChange={e => setSettings({...settings, introButtonText: e.target.value})}
                          placeholder="Ex: INICIAR OPERAÇÃO"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase opacity-50 text-black">Subtítulo Prato/Frase Cursiva</label>
                      <input 
                        type="text" 
                        className="w-full p-2.5 rounded-xl border border-gray-300 text-sm font-medium bg-white"
                        value={settings?.introSubtitle || ''}
                        onChange={e => setSettings({...settings, introSubtitle: e.target.value})}
                        placeholder="Ex: Do campo direto para a sua mesa"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase opacity-50 text-black">Texto de Apresentação (Pequeno)</label>
                      <textarea 
                        rows={2}
                        className="w-full p-2.5 rounded-xl border border-gray-300 text-sm bg-white"
                        value={settings?.introDescription || ''}
                        onChange={e => setSettings({...settings, introDescription: e.target.value})}
                        placeholder="Ex: Descrição sobre o propósito do restaurante..."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase opacity-50 text-black">Texto Inferior (Rodapé)</label>
                      <input 
                        type="text" 
                        className="w-full p-2.5 rounded-xl border border-gray-300 text-sm font-mono bg-white"
                        value={settings?.introBottomText || ''}
                        onChange={e => setSettings({...settings, introBottomText: e.target.value})}
                        placeholder="Ex: 100% ARTESANAL & AFRO-BRASILEIRO"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* CONFIGURAÇÃO DO SELETOR DE CATÁLOGOS (TELA 2) */}
              <div className="glass p-6 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif font-bold text-lg text-black">Seletor de Catálogos / Multi-Menu</h4>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={settings?.selectorEnabled !== false}
                      onChange={e => setSettings({...settings, selectorEnabled: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ml-2 text-xs font-bold uppercase opacity-65 text-black">Ativado</span>
                  </label>
                </div>

                {settings?.selectorEnabled !== false && (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase opacity-50 text-black">Título Superior</label>
                        <input 
                          type="text" 
                          className="w-full p-2.5 rounded-xl border border-gray-300 text-sm bg-white"
                          value={settings?.selectorTitle || ''}
                          onChange={e => setSettings({...settings, selectorTitle: e.target.value})}
                          placeholder="Ex: Escola de gastronomia"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase opacity-50 text-black">Subtítulo Informativo</label>
                        <input 
                          type="text" 
                          className="w-full p-2.5 rounded-xl border border-gray-300 text-sm bg-white"
                          value={settings?.selectorSubtitle || ''}
                          onChange={e => setSettings({...settings, selectorSubtitle: e.target.value})}
                          placeholder="Ex: Escolha sua experiência"
                        />
                      </div>
                    </div>

                    {/* Configuração do Catálogo 1 */}
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                      <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
                        <span className="text-xs font-extrabold uppercase text-gray-600">Item do Catálogo 1 (Esquerda)</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={settings?.catalog1Active !== false}
                            onChange={e => setSettings({...settings, catalog1Active: e.target.checked})}
                          />
                          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2 space-y-2">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase opacity-50 text-gray-500">Nome do Catálogo 1</label>
                            <input 
                              type="text" 
                              className="w-full p-2 rounded-lg border border-gray-300 text-xs font-bold bg-white"
                              value={settings?.catalog1Title || ''}
                              onChange={e => setSettings({...settings, catalog1Title: e.target.value})}
                              placeholder="Ex: Pratos Executivos"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase opacity-50 text-gray-500">Descrição/Resumo do Catálogo 1 (Abaixo da imagem)</label>
                            <input 
                              type="text" 
                              className="w-full p-2 rounded-lg border border-gray-300 text-xs bg-white text-black"
                              value={settings?.catalog1Desc || ''}
                              onChange={e => setSettings({...settings, catalog1Desc: e.target.value})}
                              placeholder="Ex: Almoços saudáveis e pratos"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase opacity-50 text-gray-500">Slogan do Catálogo 1 (Mostrado no cabeçalho do menu)</label>
                            <textarea 
                              rows={3}
                              className="w-full p-2.5 rounded-xl border border-gray-300 text-xs bg-white text-black font-medium resize-y"
                              value={settings?.catalog1Slogan || ''}
                              onChange={e => setSettings({...settings, catalog1Slogan: e.target.value})}
                              placeholder="Ex: Coleque cada frase em uma linha para que fiquem bem formatadas de forma legível!"
                            />
                          </div>
                        </div>
                        <div className="space-y flex flex-col items-center">
                          <label className="text-[9px] font-bold uppercase opacity-50 self-start text-gray-500">Imagem de Capa</label>
                          <div className="w-full h-20 rounded-lg bg-white border border-gray-300 flex items-center justify-center overflow-hidden mb-1 shadow-sm relative">
                            {settings?.catalog1Image ? (
                              <img src={settings.catalog1Image} alt="Capa do Catálogo 1" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[9px] text-gray-400">Sem Imagem</span>
                            )}
                          </div>
                          <input 
                            type="file" 
                            id="catalog1-upload"
                            accept="image/*"
                            onChange={e => handleFileChange(e, (b64) => setSettings({...settings, catalog1Image: b64}), 'catalog')}
                            className="hidden"
                          />
                          <label 
                            htmlFor="catalog1-upload"
                            className="px-2 py-1 bg-white border border-gray-300 rounded text-[9px] font-bold cursor-pointer hover:bg-gray-50 text-black text-center w-full"
                          >
                            Selecionar
                          </label>
                        </div>
                      </div>
                    </div>



                    </div>
                  )}
                </div>

              <div className="glass rounded-3xl p-8 space-y-6">
                <div className="space-y-1">
                  <h3 className="text-2xl font-serif font-medium" style={{ color: settings?.textColor || 'inherit' }}>Seu Cardápio Digital está Online!</h3>
                  <p className="opacity-40 text-sm" style={{ color: settings?.textColor || 'inherit' }}>Compartilhe o link ou o QR Code abaixo com seus clientes:</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  <div className="md:col-span-2 space-y-4">
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <div className="flex-grow w-full glass p-4 rounded-2xl font-mono text-xs break-all border border-white/10" style={{ color: settings?.textColor || 'inherit' }}>
                        {`${window.location.origin}/?slug=${settings?.slug || 'cardapio'}`}
                      </div>
                      <button 
                        onClick={copyLink}
                        className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold transition-all uppercase tracking-wider text-xs active:scale-95 text-center cursor-pointer border border-white/10 hover:bg-white/5 whitespace-nowrap"
                        style={{ color: settings?.primaryColor || '#865d39' }}
                      >
                        {copied ? 'COPIADO!' : 'COPIAR LINK'}
                      </button>
                    </div>

                    <div className="text-xs opacity-50 space-y-2 leading-relaxed" style={{ color: settings?.textColor || 'inherit' }}>
                      <p>💡 <strong>Dica de Sucesso:</strong> Imprima o QR Code e coloque-o nas suas mesas, no balcão de atendimento ou nas embalagens de entrega para que os clientes acessem seu cardápio instantaneamente!</p>
                      <p>📸 Você também pode publicá-lo nos Stories do Instagram, enviar no WhatsApp ou colocar no link da sua bio.</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                    <div className="p-3 bg-white rounded-xl shadow-md">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${window.location.origin}/?slug=${settings?.slug || 'cardapio'}`)}`}
                        alt="QR Code do Cardápio" 
                        className="w-32 h-32 object-contain" 
                        referrerPolicy="no-referrer" 
                      />
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const appLink = `${window.location.origin}/?slug=${settings?.slug || 'cardapio'}`;
                          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(appLink)}`;
                          const response = await fetch(qrUrl);
                          const blob = await response.blob();
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `qrcode-cardapio-${settings?.slug || 'menu'}.png`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          window.URL.revokeObjectURL(url);
                          toast.success('QR Code baixado com sucesso!');
                        } catch (error) {
                          console.error('Error downloading QR code:', error);
                          const appLink = `${window.location.origin}/?slug=${settings?.slug || 'cardapio'}`;
                          window.open(`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(appLink)}`, '_blank');
                        }
                      }}
                      className="w-full py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 cursor-pointer text-black shadow-sm"
                      style={{ backgroundColor: '#efedea', color: '#000000' }}
                    >
                      <Download size={14} className="text-black" />
                      <span className="text-black">Baixar QR Code</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* BAIRROS E TAXAS DE ENTREGA */}
              <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200/90 shadow-md space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                      <MapPin size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="font-serif font-black text-xl text-gray-900">Bairros e Taxas de Entrega</h3>
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-extrabold text-[11px] border border-blue-200 uppercase tracking-wider">
                          {(settings?.deliveryNeighborhoods || []).length} BAIRROS
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 max-w-xl">
                        Cadastre os bairros atendidos e seus valores de taxa de entrega. O cliente selecionará o bairro no checkout e o valor será somado ao pedido automaticamente.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Form para adicionar/editar bairro */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gray-50/80 border border-gray-200/80 space-y-4">
                  <span className="text-[11px] font-black uppercase tracking-wider text-gray-500 block">
                    {editingNeighborhoodId ? '✏️ EDITAR BAIRRO / REGIÃO' : '+ CADASTRAR NOVO BAIRRO / REGIÃO'}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-7 space-y-1">
                      <label className="text-xs font-bold uppercase text-gray-700">Nome do Bairro / Região</label>
                      <input
                        type="text"
                        placeholder="Ex: Centro, Jardim América, etc."
                        value={neighborhoodName}
                        onChange={(e) => setNeighborhoodName(e.target.value)}
                        className="w-full p-3 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none shadow-xs"
                      />
                    </div>
                    <div className="sm:col-span-3 space-y-1">
                      <label className="text-xs font-bold uppercase text-gray-700">Taxa de Entrega (R$)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-sm">R$</span>
                        <input
                          type="text"
                          placeholder="0,00"
                          value={neighborhoodFeeInput}
                          onChange={handleNeighborhoodFeeChange}
                          className="w-full p-3 pl-10 rounded-xl border border-gray-300 bg-white text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none shadow-xs"
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-2 flex items-end gap-1.5">
                      <button
                        type="button"
                        onClick={handleSaveNeighborhood}
                        className="w-full py-3 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {editingNeighborhoodId ? <Check size={16} /> : <Plus size={16} />}
                        <span>{editingNeighborhoodId ? 'Salvar' : 'Adicionar'}</span>
                      </button>
                      {editingNeighborhoodId && (
                        <button
                          type="button"
                          onClick={cancelEditNeighborhood}
                          className="py-3 px-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs transition-all cursor-pointer"
                          title="Cancelar edição"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Lista de bairros cadastrados */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-gray-700">
                      Bairros Cadastrados para Entrega
                    </span>
                    <span className="text-[11px] font-semibold text-gray-400">
                      Opção &quot;Outro&quot; (sem taxa fixa) é incluída automaticamente no checkout
                    </span>
                  </div>

                  {(settings?.deliveryNeighborhoods || []).length === 0 ? (
                    <div className="p-8 text-center rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 text-sm space-y-1">
                      <MapPin size={28} className="mx-auto text-gray-300 mb-2" />
                      <p className="font-bold text-gray-600">Nenhum bairro cadastrado ainda.</p>
                      <p className="text-xs text-gray-400">
                        Cadastre os bairros atendidos acima para que seus clientes possam selecionar a taxa correta no checkout.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {(settings?.deliveryNeighborhoods || []).map((b) => (
                        <div
                          key={b.id}
                          className="p-3.5 rounded-2xl bg-white border border-gray-200/90 shadow-xs hover:border-blue-300 transition-all flex items-center justify-between gap-3 group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                              <MapPin size={17} />
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-sm text-gray-900 truncate">
                                {b.name}
                              </div>
                              <div className="text-xs font-extrabold text-blue-600">
                                Taxa: R$ {b.fee.toFixed(2).replace('.', ',')}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => startEditNeighborhood(b)}
                              className="p-2 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-all cursor-pointer"
                              title="Editar bairro"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteNeighborhood(b.id)}
                              className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-all cursor-pointer"
                              title="Excluir bairro"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-4 items-center">
                <button 
                  onClick={saveSettings}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold shadow-lg disabled:opacity-50"
                  style={{ 
                    backgroundColor: settings?.primaryColor || '#865d39',
                    color: getContrastText(settings?.primaryColor || '#865d39')
                  }}
                >
                  {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  Salvar Alterações
                </button>
                <AnimatePresence>
                  {saveSuccess && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-xl font-bold shadow-sm border border-green-200"
                    >
                      <CheckCircle2 size={18} /> Salvo com sucesso!
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}




        {activeTab === 'categories' && (
          <div className="max-w-2xl space-y-8">
            <h2 className="text-3xl font-serif font-bold">Gerenciar Categorias</h2>
            
            <form onSubmit={handleAddCategory} className="glass p-6 rounded-2xl flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <input 
                  type="text" 
                  placeholder="Nome da categoria (Ex: Pratos Executivos)"
                  className="flex-grow p-3 rounded-xl border border-gray-300 w-full"
                  value={newCategory.title || ''}
                  onChange={e => setNewCategory({...newCategory, title: e.target.value})}
                />

              </div>
              <div className="flex gap-2 justify-end">
                <button 
                  type="submit"
                  disabled={isSubmittingCategory}
                  className="px-6 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ 
                    backgroundColor: settings?.primaryColor || '#865d39',
                    color: getContrastText(settings?.primaryColor || '#865d39')
                  }}
                >
                  {isSubmittingCategory ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : isEditingCategory ? (
                    <Save size={20} />
                  ) : (
                    <Plus size={20} />
                  )}
                  {isSubmittingCategory ? 'Salvando...' : isEditingCategory ? 'Salvar' : 'Adicionar'}
                </button>
                {isEditingCategory && (
                  <button 
                    type="button"
                    onClick={() => {
                      setIsEditingCategory(null);
                      setNewCategory({ title: '', order: 0, catalog: 'both' });
                    }}
                    className="px-6 py-3 rounded-xl bg-gray-200 font-bold cursor-pointer text-black"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            <div className="space-y-3">
              {categories.map((cat, idx) => (
                <motion.div 
                  layout
                  key={cat.id} 
                  className="glass p-4 rounded-xl flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1">
                      <button 
                        onClick={() => moveCategory(cat.id, 'up')}
                        disabled={idx === 0}
                        className="p-1 hover:bg-white/50 rounded disabled:opacity-20 cursor-pointer"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button 
                        onClick={() => moveCategory(cat.id, 'down')}
                        disabled={idx === categories.length - 1}
                        className="p-1 hover:bg-white/50 rounded disabled:opacity-20 cursor-pointer"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                      <span className="font-bold text-lg text-black">{cat.title}</span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-black/10 text-black/60 w-max">
                        {cat.catalog === 'catalog1' 
                          ? (settings?.catalog1Title || 'Catálogo 1') 
                          : cat.catalog === 'catalog2' 
                            ? (settings?.catalog2Title || 'Catálogo 2') 
                            : cat.catalog === 'catalog3'
                              ? (settings?.catalog3Title || 'Catálogo 3')
                              : cat.catalog === 'catalog4'
                                ? (settings?.catalog4Title || 'Catálogo 4')
                                : cat.catalog === 'all'
                                ? 'Todos os Catálogos'
                                : 'Varejo (Ambos - 1 & 2)'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={() => {
                        setIsEditingCategory(cat);
                        setNewCategory({ title: cat.title, order: cat.order || 0, catalog: (cat.catalog || 'both') as any });
                        scrollToTop();
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer transition-colors shadow-sm"
                      title="Editar Categoria"
                    >
                      <Edit2 size={16} />
                      <span className="hidden sm:inline">Editar</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => deleteCategory(cat.id)}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer transition-colors shadow-sm"
                      title="Excluir Categoria"
                    >
                      <Trash2 size={16} />
                      <span className="hidden sm:inline">Excluir</span>
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'orderMenu' && (
          <div className="space-y-8 max-w-5xl">
            {/* Header Card */}
            <div className="bg-white/95 backdrop-blur-md p-6 sm:p-7 rounded-3xl border border-gray-200/90 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm shrink-0 mt-0.5"
                  style={{ 
                    backgroundColor: `${settings?.primaryColor || '#865d39'}15`,
                    border: `1.5px solid ${settings?.primaryColor || '#865d39'}30`
                  }}
                >
                  <ArrowUpDown size={26} style={{ color: settings?.primaryColor || '#865d39' }} />
                </div>
                <div>
                  <h2 
                    className="text-2xl sm:text-3xl font-serif font-black tracking-tight"
                    style={{ color: settings?.primaryColor || '#865d39' }}
                  >
                    Ordenar Cardápio
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-700 font-medium max-w-2xl mt-1 leading-relaxed">
                    Defina a sequência exata em que os pratos e combos aparecerão para os clientes no cardápio.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('menu')}
                className="px-4 py-3 rounded-2xl bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-bold flex items-center gap-2 shadow-xs text-xs sm:text-sm cursor-pointer self-start sm:self-auto transition-all active:scale-[0.98]"
              >
                <Package size={16} /> Ir para Cadastro de Pratos
              </button>
            </div>

            {/* Category Selector Tabs */}
            <div className="bg-white/95 backdrop-blur-md p-5 rounded-3xl border border-gray-200/90 shadow-md space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-gray-200/80 pb-3">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-800 flex items-center gap-2">
                  <Layers size={16} className="text-gray-500" /> 1. Escolha a Categoria para Reordenar
                </label>
                <span className="text-xs text-gray-500 font-medium">
                  {categories.length} categoria(s) cadastradas
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {categories.map((cat) => {
                  const catProductsCount = products.filter(p => p.categoryId === cat.id).length;
                  const isSelected = (selectedOrderCategoryId || categories[0]?.id) === cat.id;

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedOrderCategoryId(cat.id)}
                      className={cn(
                        "px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border",
                        isSelected
                          ? "shadow-md scale-[1.02] border-transparent"
                          : "bg-white hover:bg-gray-50 text-gray-700 border-gray-200 shadow-2xs"
                      )}
                      style={isSelected ? { 
                        backgroundColor: settings?.primaryColor || '#865d39', 
                        color: getContrastText(settings?.primaryColor || '#865d39') 
                      } : {}}
                    >
                      <span>{cat.title}</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-black",
                        isSelected ? "bg-black/20 text-white" : "bg-black/5 text-gray-600"
                      )}>
                        {catProductsCount} {catProductsCount === 1 ? 'item' : 'itens'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Products Ordering Area for Selected Category */}
            {(() => {
              const activeCatId = selectedOrderCategoryId || categories[0]?.id;
              const activeCat = categories.find(c => c.id === activeCatId);

              if (!activeCat) {
                return (
                  <div className="text-center p-12 bg-white/95 backdrop-blur-md rounded-3xl border border-gray-200 shadow-md space-y-3">
                    <Layers size={36} className="mx-auto text-gray-400 opacity-60" />
                    <p className="text-gray-800 font-bold text-base">Nenhuma categoria encontrada.</p>
                    <p className="text-xs text-gray-500">Crie categorias primeiro na aba "Categorias" para vincular e ordenar seus pratos.</p>
                  </div>
                );
              }

              const catProducts = products
                .filter(p => p.categoryId === activeCat.id)
                .sort((a, b) => {
                  const orderA = typeof a.order === 'number' ? a.order : 9999;
                  const orderB = typeof b.order === 'number' ? b.order : 9999;
                  if (orderA !== orderB) return orderA - orderB;
                  return a.title.localeCompare(b.title);
                });

              return (
                <div className="space-y-4">
                  {/* Category Header & Batch Action Controls */}
                  <div className="bg-white/95 backdrop-blur-md p-5 rounded-3xl border border-gray-200/90 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-bold font-serif text-lg shrink-0 shadow-2xs"
                        style={{
                          backgroundColor: `${settings?.primaryColor || '#865d39'}15`,
                          color: settings?.primaryColor || '#865d39'
                        }}
                      >
                        {activeCat.title.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-serif font-black text-lg text-gray-900 flex items-center gap-2">
                          <span style={{ color: settings?.primaryColor || '#865d39' }}>{activeCat.title}</span>
                          <span className="text-[10px] font-sans font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200">
                            {catProducts.length} {catProducts.length === 1 ? 'prato' : 'pratos'}
                          </span>
                        </h3>
                        <p className="text-xs text-gray-500 font-medium">
                          Use as setas para alterar a posição ou reordenar instantaneamente.
                        </p>
                      </div>
                    </div>

                    {catProducts.length > 1 && (
                      <div className="flex items-center gap-2 flex-wrap self-stretch sm:self-auto justify-end">
                        <button
                          type="button"
                          onClick={() => normalizeCategoryProductsOrder(activeCat.id)}
                          className="px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 font-bold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all active:scale-95"
                          title="Recalcula e salva as posições sequenciais (1, 2, 3...)"
                        >
                          <ListOrdered size={14} /> Numerar Sequencial
                        </button>
                        <button
                          type="button"
                          onClick={() => sortCategoryAlphabetically(activeCat.id)}
                          className="px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 font-bold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all active:scale-95"
                          title="Organiza os pratos desta categoria em ordem alfabética de A a Z"
                        >
                          <Sparkles size={14} /> Ordem A-Z
                        </button>
                      </div>
                    )}
                  </div>

                  {/* List of Products in this Category */}
                  {catProducts.length === 0 ? (
                    <div className="text-center py-16 bg-white/95 backdrop-blur-md rounded-3xl space-y-3 border border-dashed border-gray-300 p-8 shadow-sm">
                      <Package size={36} className="mx-auto text-gray-400 opacity-60" />
                      <p className="text-gray-800 font-bold text-base">Nenhum produto cadastrado nesta categoria.</p>
                      <p className="text-xs text-gray-500 max-w-md mx-auto">
                        Para adicionar pratos ou combos a esta categoria, acesse a aba "Gerenciar Cardápio".
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setNewProduct(prev => ({ ...prev, categoryId: activeCat.id }));
                          setActiveTab('menu');
                        }}
                        className="mt-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md cursor-pointer transition-all"
                        style={{ backgroundColor: settings?.primaryColor || '#865d39' }}
                      >
                        + Cadastrar Prato nesta Categoria
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {catProducts.map((product, idx) => (
                        <motion.div
                          layout
                          key={product.id}
                          className="bg-white/95 backdrop-blur-md p-4 sm:p-5 rounded-3xl flex items-center justify-between gap-3.5 border border-gray-200/90 shadow-md hover:shadow-lg transition-all group"
                        >
                          {/* Left: Reorder Arrows & Position Badge & Thumbnail & Info */}
                          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                            {/* Up/Down Controls */}
                            <div className="flex flex-col gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => moveProduct(product.id, activeCat.id, 'up')}
                                disabled={idx === 0}
                                className="p-1.5 bg-gray-50 hover:bg-gray-200/80 border border-gray-200 rounded-lg disabled:opacity-20 cursor-pointer text-gray-800 hover:text-black transition-colors"
                                title="Subir uma posição"
                              >
                                <ArrowUp size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveProduct(product.id, activeCat.id, 'down')}
                                disabled={idx === catProducts.length - 1}
                                className="p-1.5 bg-gray-50 hover:bg-gray-200/80 border border-gray-200 rounded-lg disabled:opacity-20 cursor-pointer text-gray-800 hover:text-black transition-colors"
                                title="Descer uma posição"
                              >
                                <ArrowDown size={16} />
                              </button>
                            </div>

                            {/* Position Number Pill */}
                            <div 
                              className="w-8 h-8 rounded-xl font-serif font-black text-xs sm:text-sm flex items-center justify-center shrink-0 shadow-2xs border"
                              style={{ 
                                backgroundColor: idx < 3 ? (settings?.primaryColor ? `${settings.primaryColor}18` : '#865d3918') : '#f9fafb',
                                borderColor: idx < 3 ? (settings?.primaryColor ? `${settings.primaryColor}35` : '#865d3935') : '#e5e7eb',
                                color: idx < 3 ? (settings?.primaryColor || '#865d39') : '#374151'
                              }}
                              title={`Posição #${idx + 1}`}
                            >
                              #{idx + 1}
                            </div>

                            {/* Product Thumbnail */}
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={product.title}
                                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border border-gray-200 shadow-sm shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 shrink-0">
                                <Package size={22} />
                              </div>
                            )}

                            {/* Product Details */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 
                                  className="font-serif font-bold text-base sm:text-lg tracking-tight"
                                  style={{ color: settings?.primaryColor || '#865d39' }}
                                >
                                  {product.title}
                                </h4>
                                {product.trackStock && (
                                  <span className={cn(
                                    "text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full whitespace-nowrap shadow-2xs border flex items-center gap-1",
                                    (product.stockQuantity ?? 0) > 0 
                                      ? "bg-emerald-50 text-emerald-800 border-emerald-300" 
                                      : "bg-red-50 text-red-700 border-red-200"
                                  )}>
                                    <Zap size={11} className={(product.stockQuantity ?? 0) > 0 ? "text-emerald-600 fill-emerald-600" : "text-red-500"} />
                                    <span>Pronta Entrega: <strong>{product.stockQuantity ?? 0} un</strong></span>
                                  </span>
                                )}
                                {product.isCombo && (
                                  <span className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-950 whitespace-nowrap shadow-2xs">
                                    🍱 Combo {product.comboQuantity || 5} marmitas
                                  </span>
                                )}
                                {product.isComboOnly && (
                                  <span className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full bg-purple-100 border border-purple-300 text-purple-900 whitespace-nowrap shadow-2xs">
                                    📦 Apenas em Combo (Oculto avulso)
                                  </span>
                                )}
                                {product.isActive === false && (
                                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                                    Oculto
                                  </span>
                                )}
                              </div>

                              {product.description && (
                                <p className="text-xs sm:text-sm text-gray-600 font-medium line-clamp-1 mt-0.5">
                                  {product.description}
                                </p>
                              )}

                              <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-xs sm:text-sm font-serif font-black text-gray-900">
                                  {currencySymbol} {(product.price > 0 ? product.price : (product.oldPrice || 0)).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Quick Move to Extremity & Edit Button */}
                          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => moveProductToExtremity(product.id, activeCat.id, 'top')}
                              disabled={idx === 0}
                              className="p-2 hover:bg-gray-100 rounded-xl text-gray-600 hover:text-black disabled:opacity-20 transition-all cursor-pointer hidden sm:flex border border-transparent hover:border-gray-200"
                              title="Mover para o primeiro lugar (#1)"
                            >
                              <ChevronsUp size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveProductToExtremity(product.id, activeCat.id, 'bottom')}
                              disabled={idx === catProducts.length - 1}
                              className="p-2 hover:bg-gray-100 rounded-xl text-gray-600 hover:text-black disabled:opacity-20 transition-all cursor-pointer hidden sm:flex border border-transparent hover:border-gray-200"
                              title="Mover para a última posição"
                            >
                              <ChevronsDown size={16} />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setIsEditingProduct(product);
                                setNewProduct({
                                  title: product.title,
                                  description: product.description,
                                  price: product.price,
                                  oldPrice: product.oldPrice || 0,
                                  priceType: product.priceType || 'fixed',
                                  image: product.image,
                                  categoryId: product.categoryId,
                                  isMeal: product.isMeal || false,
                                  isCustomCake: product.isCustomCake || false,
                                  isCustomSandwich: product.isCustomSandwich || false,
                                  customFillings: product.customFillings || '',
                                  ingredients: product.ingredients || '',
                                  allowedSides: product.allowedSides || [],
                                  isActive: product.isActive ?? true,
                                  hasSizes: product.hasSizes || false,
                                  sizes: product.sizes || [],
                                  cakeGalleryId: product.cakeGalleryId || '',
                                  isCombo: product.isCombo || false,
                                  comboQuantity: product.comboQuantity || 5,
                                  comboAllowedProductIds: product.comboAllowedProductIds || [],
                                  isComboOnly: product.isComboOnly || false,
                                  order: product.order,
                                  nutritionalInfo: product.nutritionalInfo,
                                  trackStock: product.trackStock ?? false,
                                  stockQuantity: typeof product.stockQuantity === 'number' ? product.stockQuantity : 0
                                });
                                setPriceInput(product.price ? product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
                                setActiveTab('menu');
                              }}
                              className="p-2.5 hover:bg-blue-50 text-blue-600 hover:text-blue-700 bg-white border border-gray-200 rounded-xl transition-all cursor-pointer shadow-2xs"
                              title="Editar Produto"
                            >
                              <Edit2 size={16} />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === 'menu' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-3xl font-serif font-bold">Gerenciar Cardápio</h2>
              <button
                type="button"
                onClick={() => setActiveTab('orderMenu')}
                className="px-4 py-2.5 rounded-xl bg-amber-600/15 hover:bg-amber-600/25 text-amber-950 font-bold flex items-center gap-2 border border-amber-500/30 transition-all text-xs sm:text-sm cursor-pointer shadow-sm self-start sm:self-auto"
              >
                <ArrowUpDown size={16} /> Ordenar Pratos
              </button>
            </div>

            <form onSubmit={handleAddProduct} className="glass p-6 md:p-8 rounded-2xl space-y-6 text-black border border-white/40 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-gray-200">
                <div>
                  <h3 className="text-xl md:text-2xl font-serif font-bold text-gray-900 flex items-center gap-2">
                    <Package size={24} style={{ color: settings?.primaryColor || '#865d39' }} />
                    {isEditingProduct ? `Editar Produto: ${isEditingProduct.title}` : 'Novo Produto no Cardápio'}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Cadastre pratos individuais, combos promocionais, kits ou opções personalizadas para o seu cardápio.
                  </p>
                </div>
                {isEditingProduct && (
                  <span className="self-start sm:self-auto px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-bold border border-amber-300">
                    Modo de Edição
                  </span>
                )}
              </div>

              {/* SECTION 1: DADOS BÁSICOS */}
              <div className="bg-white/80 p-5 rounded-2xl border border-gray-200 space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-800 border-b border-gray-100 pb-2">
                  <span className="w-6 h-6 rounded-full bg-[#865d39]/15 text-[#865d39] flex items-center justify-center text-xs font-black">1</span>
                  Informações Básicas do Produto
                </div>

                {/* Tipo de Formato do Produto */}
                <div className="space-y-1.5 bg-amber-50/70 p-3.5 rounded-xl border border-amber-200">
                  <label className="text-xs font-bold uppercase text-amber-950 block">Formato do Item no Cardápio</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setNewProduct({ ...newProduct, isCombo: false })}
                      className={cn(
                        "p-3 rounded-xl border-2 text-left transition-all flex items-center gap-3 cursor-pointer",
                        !newProduct.isCombo
                          ? "bg-white border-[#865d39] shadow-sm"
                          : "bg-white/60 border-gray-200 hover:bg-white text-gray-600"
                      )}
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#865d39]/10 text-[#865d39] flex items-center justify-center font-bold text-sm shrink-0">
                        🍽️
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900">Prato / Item Individual</div>
                        <div className="text-[10px] text-gray-500">Marmita única, sobremesa ou item avulso</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewProduct({ ...newProduct, isCombo: true, isMeal: false })}
                      className={cn(
                        "p-3 rounded-xl border-2 text-left transition-all flex items-center gap-3 cursor-pointer",
                        newProduct.isCombo
                          ? "bg-white border-[#865d39] shadow-sm"
                          : "bg-white/60 border-gray-200 hover:bg-white text-gray-600"
                      )}
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-900 flex items-center justify-center font-bold text-sm shrink-0">
                        🍱
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900">Combo de Marmitas Personalizável</div>
                        <div className="text-[10px] text-gray-500">Ex: 5, 10, 20, 30+ com escolha de sabores</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Disponível apenas para montagem de combo, ocultar prato avulso */}
                {!newProduct.isCombo && (
                  <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        id="product-is-combo-only-checkbox"
                        checked={!!newProduct.isComboOnly}
                        onChange={(e) => setNewProduct({ ...newProduct, isComboOnly: e.target.checked })}
                        className="w-4 h-4 mt-0.5 rounded text-amber-800 focus:ring-amber-700 border-gray-300 cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="text-xs sm:text-sm font-bold text-gray-900 block">
                          Disponível apenas para montagem de combo, ocultar prato avulso
                        </span>
                        <span className="text-[11px] text-gray-500 block mt-0.5">
                          Quando marcado, este prato não aparecerá como item avulso no cardápio do cliente, ficando disponível exclusivamente para a montagem de combos.
                        </span>
                      </div>
                    </label>
                  </div>
                )}

                {/* Bloco de Configuração de Combo quando isCombo for true */}
                {newProduct.isCombo && (
                  <div className="p-4 bg-amber-50/80 rounded-xl border-2 border-amber-300 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-amber-950 uppercase tracking-wide">
                          ⚙️ Configurações do Combo de Marmitas
                        </span>
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900">
                        Trava de seleção ativa para o cliente
                      </span>
                    </div>

                    {/* Quantidade de Marmitas do Combo */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-gray-800 flex items-center justify-between">
                        <span>Quantidade Exata de Marmitas que o cliente deve escolher *</span>
                        <span className="text-[11px] text-amber-900 font-bold">
                          Limite: {newProduct.comboQuantity || 5} marmitas
                        </span>
                      </label>
                      
                      <div className="flex flex-wrap gap-2 items-center">
                        {[5, 10, 15, 20, 30, 40, 50].map((qty) => (
                          <button
                            key={qty}
                            type="button"
                            onClick={() => setNewProduct({ ...newProduct, comboQuantity: qty })}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                              newProduct.comboQuantity === qty
                                ? "bg-[#865d39] text-white shadow-sm scale-105"
                                : "bg-white text-gray-700 border border-gray-300 hover:border-gray-400"
                            )}
                          >
                            Combo {qty}
                          </button>
                        ))}
                        
                        <div className="flex items-center gap-1.5 ml-auto sm:ml-2">
                          <span className="text-[11px] text-gray-500 font-bold">Ou outro valor:</span>
                          <input
                            type="number"
                            min="1"
                            max="200"
                            className="w-20 p-1.5 text-xs rounded-lg border border-gray-300 bg-white text-black font-bold text-center"
                            value={newProduct.comboQuantity || ''}
                            onChange={e => setNewProduct({ ...newProduct, comboQuantity: Math.max(1, parseInt(e.target.value) || 1) })}
                            placeholder="Qtd"
                          />
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-500">
                        O cliente só conseguirá adicionar o combo ao pedido quando selecionar exatamente {newProduct.comboQuantity || 5} unidades entre os sabores permitidos.
                      </p>
                    </div>

                    {/* Seleção de Pratos Permitidos no Combo */}
                    <div className="space-y-2 pt-2 border-t border-amber-200/60">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <label className="text-xs font-bold uppercase text-gray-800 block">
                            Quais pratos o cliente pode escolher neste combo?
                          </label>
                          <span className="text-[11px] text-gray-500">
                            {(newProduct.comboAllowedProductIds || []).length === 0
                              ? 'Todos os pratos cadastrados estão permitidos por padrão'
                              : `${(newProduct.comboAllowedProductIds || []).length} prato(s) liberado(s) para este combo`}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const eligibleIds = products.filter(p => !p.isCombo && (!isEditingProduct || p.id !== isEditingProduct.id)).map(p => p.id);
                              setNewProduct({ ...newProduct, comboAllowedProductIds: eligibleIds });
                              toast.success('Todos os pratos foram marcados para este combo!');
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors cursor-pointer"
                          >
                            ✓ Marcar Todos
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewProduct({ ...newProduct, comboAllowedProductIds: [] });
                              toast.success('Filtro limpo (todos disponíveis)');
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors cursor-pointer"
                          >
                            ✕ Desmarcar Todos
                          </button>
                        </div>
                      </div>

                      {/* Search Filter for dishes */}
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                          type="text"
                          placeholder="Filtrar pratos para selecionar..."
                          value={comboDishSearch}
                          onChange={e => setComboDishSearch(e.target.value)}
                          className="w-full p-2 pl-8 text-xs rounded-lg border border-gray-300 bg-white text-black font-medium"
                        />
                      </div>

                      {/* Products List Grid */}
                      {(() => {
                        const availableDishes = products
                          .filter(p => !p.isCombo && (!isEditingProduct || p.id !== isEditingProduct.id))
                          .filter(p => {
                            if (!comboDishSearch.trim()) return true;
                            const term = comboDishSearch.toLowerCase();
                            const cat = categories.find(c => c.id === p.categoryId)?.title?.toLowerCase() || '';
                            return p.title.toLowerCase().includes(term) || cat.includes(term);
                          });

                        if (availableDishes.length === 0) {
                          return (
                            <div className="p-4 bg-white/70 rounded-xl border border-dashed border-gray-300 text-center text-xs text-gray-500">
                              Nenhum prato avulso encontrado para adicionar ao combo. Cadastre pratos individuais primeiro.
                            </div>
                          );
                        }

                        return (
                          <div className="max-h-60 overflow-y-auto space-y-1.5 p-2 bg-white/80 rounded-xl border border-gray-200 custom-scrollbar">
                            {availableDishes.map((dish) => {
                              const isChecked = (newProduct.comboAllowedProductIds || []).includes(dish.id);
                              const cat = categories.find(c => c.id === dish.categoryId);
                              return (
                                <label
                                  key={dish.id}
                                  className={cn(
                                    "flex items-center gap-3 p-2 rounded-lg border transition-all cursor-pointer",
                                    isChecked
                                      ? "bg-amber-50/90 border-amber-300 shadow-xs"
                                      : "bg-white border-gray-200 hover:bg-gray-50 text-gray-700"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-gray-300 text-amber-800 focus:ring-amber-800"
                                    checked={isChecked}
                                    onChange={e => {
                                      const current = newProduct.comboAllowedProductIds || [];
                                      if (e.target.checked) {
                                        setNewProduct({
                                          ...newProduct,
                                          comboAllowedProductIds: [...current, dish.id]
                                        });
                                      } else {
                                        setNewProduct({
                                          ...newProduct,
                                          comboAllowedProductIds: current.filter(id => id !== dish.id)
                                        });
                                      }
                                    }}
                                  />
                                  <div className="w-9 h-9 rounded-lg bg-gray-100 overflow-hidden shrink-0 border border-gray-200">
                                    {dish.image ? (
                                      <img src={dish.image} alt={dish.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400 font-bold">🍽️</div>
                                    )}
                                  </div>
                                  <div className="flex-grow min-w-0">
                                    <div className="text-xs font-bold text-gray-900 truncate">{dish.title}</div>
                                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                                      {cat && <span className="bg-gray-100 px-1.5 py-0.2 rounded">{cat.title}</span>}
                                      {dish.isComboOnly && (
                                        <span className="bg-purple-100 text-purple-800 font-bold px-1.5 py-0.2 rounded">Apenas p/ combo</span>
                                      )}
                                      {dish.trackStock && (
                                        <span className={cn(
                                          "font-bold px-1.5 py-0.2 rounded text-[9px]",
                                          (dish.stockQuantity ?? 0) > 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"
                                        )}>
                                          ⚡ {(dish.stockQuantity ?? 0) > 0 ? (dish.stockQuantity + ' un pronta entrega') : 'Esgotado'}
                                        </span>
                                      )}
                                      {Boolean(dish.nutritionalInfo?.calories) && (
                                        <span>• {dish.nutritionalInfo?.calories} kcal</span>
                                      )}
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase text-gray-700">Título / Nome do Prato *</label>
                      <input 
                        type="text" 
                        className="w-full p-3 rounded-xl border border-gray-300 bg-white text-black font-medium focus:ring-2 focus:ring-amber-800/30 focus:border-amber-800 transition-all text-sm"
                        value={newProduct.title || ''}
                        onChange={e => setNewProduct({...newProduct, title: e.target.value})}
                        placeholder="Ex: Beringela caprese e arroz negro - 350g"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase text-gray-700">Categoria do Cardápio *</label>
                      {categories.length === 0 ? (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2 text-black">
                          <p className="text-xs text-red-700 font-bold leading-relaxed">
                            ⚠️ Nenhuma categoria cadastrada. Crie uma abaixo:
                          </p>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              placeholder="Ex: Marmitas - Top 10, Kit Detox..." 
                              className="flex-grow p-2 text-xs rounded-lg border border-red-300 bg-white text-black"
                              id="quick-category-input"
                            />
                            <button 
                              type="button" 
                              onClick={async () => {
                                const input = document.getElementById('quick-category-input') as HTMLInputElement;
                                if (!input || !input.value.trim()) {
                                  toast.error('Digite o nome da categoria.');
                                  return;
                                }
                                const title = input.value.trim();
                                try {
                                  await addDoc(collection(db, 'categorias'), {
                                    title,
                                    order: 0,
                                    catalog: 'both'
                                  });
                                  toast.success('Categoria adicionada com sucesso!');
                                } catch (err) {
                                  toast.error('Erro ao adicionar categoria.');
                                }
                              }}
                              className="px-3 py-2 bg-[#865d39] text-white text-xs font-bold rounded-lg hover:brightness-110 transition-all flex items-center gap-1"
                            >
                              <Plus size={12} /> Criar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <select 
                          className="w-full p-3 rounded-xl border border-gray-300 bg-white text-black font-medium focus:ring-2 focus:ring-amber-800/30 focus:border-amber-800 transition-all text-sm cursor-pointer"
                          value={newProduct.categoryId}
                          onChange={e => setNewProduct({...newProduct, categoryId: e.target.value})}
                          required
                        >
                          <option value="">Selecione uma categoria...</option>
                          {categories.map(cat => {
                            const catName = cat.catalog === 'catalog1' 
                              ? (settings?.catalog1Title || 'Catálogo 1') 
                              : cat.catalog === 'catalog2' 
                                ? (settings?.catalog2Title || 'Catálogo 2') 
                                : cat.catalog === 'catalog3'
                                  ? (settings?.catalog3Title || 'Catálogo 3')
                                  : cat.catalog === 'catalog4'
                                    ? (settings?.catalog4Title || 'Catálogo 4')
                                    : cat.catalog === 'all'
                                    ? 'Todos os Cardápios'
                                    : 'Ambos os Cardápios';
                            return (
                              <option key={cat.id} value={cat.id}>
                                {cat.title} — ({catName})
                              </option>
                            );
                          })}
                        </select>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase text-gray-700">Descrição / Detalhes do Produto</label>
                      <textarea 
                        className="w-full p-3 rounded-xl border border-gray-300 bg-white text-black font-medium focus:ring-2 focus:ring-amber-800/30 focus:border-amber-800 transition-all text-sm"
                        rows={3}
                        value={newProduct.description}
                        onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                        placeholder="Descreva os ingredientes principais, peso em gramas, modo de servir, etc..."
                      />
                    </div>
                  </div>

                  <div className="space-y-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-gray-700">Foto do Produto</label>
                      <div className="p-4 bg-gray-50/80 rounded-xl border border-dashed border-gray-300 flex flex-col sm:flex-row items-center gap-4">
                        <div className="w-28 h-28 rounded-xl bg-white border border-gray-200 flex items-center justify-center overflow-hidden shadow-sm shrink-0">
                          {newProduct.image ? (
                            <img src={newProduct.image} alt="Pré-visualização" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <ImageIcon className="text-gray-300" size={36} />
                          )}
                        </div>
                        <div className="space-y-2 text-center sm:text-left">
                          <input 
                            type="file" 
                            id="product-image"
                            accept="image/*"
                            onChange={e => handleFileChange(e, (b64) => setNewProduct({...newProduct, image: b64}))}
                            className="hidden"
                          />
                          <label 
                            htmlFor="product-image"
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-gray-300 hover:border-gray-400 rounded-xl text-xs font-bold cursor-pointer hover:bg-gray-50 shadow-sm transition-all text-gray-800"
                          >
                            <ImageIcon size={16} />
                            {newProduct.image ? 'Trocar Imagem' : 'Enviar Foto do Prato'}
                          </label>
                          <p className="text-[11px] text-gray-500 leading-tight">
                            Formatos aceitos: JPG, PNG, WEBP. Fotos nítidas aumentam os pedidos!
                          </p>
                          <div className="pt-2">
                            <label className="text-[11px] font-bold text-gray-700 block mb-1">
                              Ou cole/edite o Link direto da Imagem (URL https://...):
                            </label>
                            <input
                              type="url"
                              value={newProduct.image || ""}
                              onChange={(e) => setNewProduct({ ...newProduct, image: e.target.value })}
                              placeholder="https://i.ibb.co/... ou link da imagem"
                              className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white text-black"
                            />
                          </div>
                          {newProduct.image && (
                            <button
                              type="button"
                              onClick={() => setNewProduct({...newProduct, image: ''})}
                              className="text-[11px] text-red-600 hover:text-red-800 font-bold block"
                            >
                              Remover foto
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: PREÇO & VARIAÇÕES / COMBOS */}
              <div className="bg-white/80 p-5 rounded-2xl border border-gray-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2">
                  <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-800">
                    <span className="w-6 h-6 rounded-full bg-[#865d39]/15 text-[#865d39] flex items-center justify-center text-xs font-black">2</span>
                    Preço, Tamanhos & Combos Promocionais
                  </div>

                  {/* Toggle Mode */}
                  <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setNewProduct({ ...newProduct, hasSizes: false });
                      }}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer",
                        !newProduct.hasSizes ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                      )}
                    >
                      Preço Único
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewProduct({ ...newProduct, hasSizes: true });
                      }}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer",
                        newProduct.hasSizes ? "bg-[#865d39] text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
                      )}
                    >
                      Múltiplos Tamanhos / Combos
                    </button>
                  </div>
                </div>

                {!newProduct.hasSizes ? (
                  /* Single Price Fields */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase text-gray-700">Preço Promocional (Por) ({currencySymbol}) *</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-sm">{currencySymbol}</span>
                        <input 
                          type="text" 
                          className="w-full p-3 pl-11 rounded-xl border border-gray-300 bg-white font-bold text-base text-gray-900 focus:ring-2 focus:ring-amber-800/30 focus:border-amber-800"
                          value={priceInput}
                          onChange={e => handlePriceChange(e.target.value)}
                          placeholder="0,00"
                        />
                      </div>
                      <span className="text-[11px] text-gray-500">Valor principal de venda cobrado no cardápio.</span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase text-gray-700">Preço Original Riscado (De) ({currencySymbol}) (Opcional)</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-sm">{currencySymbol}</span>
                        <input 
                          type="text" 
                          className="w-full p-3 pl-11 rounded-xl border border-gray-300 bg-white text-sm text-gray-600 focus:ring-2 focus:ring-amber-800/30 focus:border-amber-800"
                          value={oldPriceInput}
                          onChange={e => handleOldPriceChange(e.target.value)}
                          placeholder="0,00"
                        />
                      </div>
                      <span className="text-[11px] text-gray-500">Se preenchido, aparecerá como desconto "De R$ XX por R$ YY".</span>
                    </div>
                  </div>
                ) : (
                  /* Multiple Sizes / Combos */
                  <div className="space-y-4 pt-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-amber-50/80 rounded-xl border border-amber-200">
                      <div>
                        <span className="text-xs font-bold text-amber-950 block">Combos e Variações de Preço</span>
                        <span className="text-[11px] text-amber-800">
                          Configure opções como Marmita Individual, Combo 5 Marmitas, Combo 10, Combo 20 ou tamanhos P/M/G.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const standard = [
                            { id: 'size_ind_' + Math.random().toString(36).substring(2, 8), name: 'Marmita individual', price: 28 },
                            { id: 'size_c5_' + Math.random().toString(36).substring(2, 8), name: 'Combo 5 marmitas', price: 120 },
                            { id: 'size_c10_' + Math.random().toString(36).substring(2, 8), name: 'Combo 10 marmitas', price: 210 },
                            { id: 'size_c20_' + Math.random().toString(36).substring(2, 8), name: 'Combo 20 marmitas', price: 405 },
                            { id: 'size_c30_' + Math.random().toString(36).substring(2, 8), name: 'Combo 30 marmitas', price: 600 }
                          ];
                          setNewProduct({
                            ...newProduct,
                            hasSizes: true,
                            sizes: standard
                          });
                          toast.success('Combos e tamanhos padrão carregados com sucesso!');
                        }}
                        className="px-3.5 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
                      >
                        ⚡ Carregar Tabela Padrão de Marmitas (Individual + Combos 5, 10, 20, 30)
                      </button>
                    </div>

                    {/* Add / Edit Size Option Form */}
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-800 block">
                        {editingSizeId ? '✏️ Editar Opção de Tamanho / Combo' : '➕ Adicionar Nova Opção de Tamanho ou Combo'}
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                        <div className="sm:col-span-7 space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-700">Nome da Opção / Combo</label>
                          <input 
                            type="text"
                            placeholder="Ex: Marmita individual, Combo 5 marmitas, Porção 500g..."
                            className="w-full p-2.5 text-xs rounded-xl border border-gray-300 bg-white text-black font-medium focus:ring-2 focus:ring-amber-800/30"
                            value={sizeForm.name}
                            onChange={e => setSizeForm({ ...sizeForm, name: e.target.value })}
                          />
                        </div>
                        <div className="sm:col-span-3 space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-700">Preço ({currencySymbol})</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">{currencySymbol}</span>
                            <input 
                              type="text"
                              placeholder="0,00"
                              className="w-full p-2.5 pl-8 text-xs rounded-xl border border-gray-300 bg-white text-black font-bold focus:ring-2 focus:ring-amber-800/30"
                              value={sizeForm.price}
                              onChange={e => {
                                const digits = e.target.value.replace(/\D/g, '');
                                if (!digits) {
                                  setSizeForm({ ...sizeForm, price: '' });
                                  return;
                                }
                                const val = parseInt(digits) / 100;
                                setSizeForm({ ...sizeForm, price: val.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) });
                              }}
                            />
                          </div>
                        </div>
                        <div className="sm:col-span-2 flex gap-1.5">
                          <button
                            type="button"
                            onClick={handleAddSizeOption}
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                          >
                            {editingSizeId ? <Save size={14} /> : <Plus size={14} />}
                            {editingSizeId ? 'Salvar' : 'Adicionar'}
                          </button>
                          {editingSizeId && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSizeId(null);
                                setSizeForm({ name: '', price: '', oldPrice: '' });
                              }}
                              className="px-2.5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                              title="Cancelar edição"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* List of defined sizes */}
                    <div className="space-y-2">
                      {(newProduct.sizes || []).length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                          {(newProduct.sizes || []).map((size, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-200 shadow-xs">
                              <div>
                                <span className="font-bold text-xs text-gray-900 block">{size.name}</span>
                                <span className="text-xs text-emerald-700 font-bold">
                                  {currencySymbol} {Number(size.price || 0).toFixed(2).replace('.', ',')}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSizeId(size.id);
                                    setSizeForm({
                                      name: size.name,
                                      price: (size.price && size.price > 0) ? size.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
                                      oldPrice: ''
                                    });
                                  }}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                  title="Editar"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (editingSizeId === size.id) {
                                      setEditingSizeId(null);
                                      setSizeForm({ name: '', price: '', oldPrice: '' });
                                    }
                                    setNewProduct({
                                      ...newProduct,
                                      sizes: (newProduct.sizes || []).filter((_, sIdx) => sIdx !== idx)
                                    });
                                  }}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Excluir"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center p-4 bg-gray-50/50 rounded-xl border border-dashed border-gray-300 text-xs text-gray-500">
                          Nenhum tamanho adicionado. Clique no botão de carregar tabela padrão acima ou adicione manualmente.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 3: TABELA NUTRICIONAL (COLAPSÁVEL / ACORDEÃO) */}
              <div className="bg-white/80 rounded-2xl border border-gray-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowNutritionalForm(!showNutritionalForm)}
                  className="w-full p-4 md:p-5 flex items-center justify-between bg-gray-50/70 hover:bg-gray-100/80 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#865d39]/15 text-[#865d39] flex items-center justify-center text-xs font-black">3</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">Tabela Nutricional</span>
                        <span className="text-[10px] uppercase font-bold bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                          Padrão ANVISA (Opcional)
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {newProduct.nutritionalInfo?.calories || newProduct.nutritionalInfo?.servingSize
                          ? '✓ Informações nutricionais cadastradas para este prato'
                          : 'Clique para expandir e informar calorias, carboidratos, proteínas, etc.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <span className="text-xs font-bold hidden sm:inline">
                      {showNutritionalForm ? 'Recolher' : 'Preencher Tabela'}
                    </span>
                    {showNutritionalForm ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </button>

                {showNutritionalForm && (
                  <div className="p-5 border-t border-gray-200 space-y-4 bg-white/40">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-700">Porções por embalagem</label>
                        <input 
                          type="text" 
                          placeholder="Ex: 1 porção ou 4 porções"
                          className="w-full p-2 rounded-lg border border-gray-300 text-xs font-semibold bg-white text-black"
                          value={newProduct.nutritionalInfo?.servingsPerContainer || ''}
                          onChange={e => setNewProduct({
                            ...newProduct,
                            nutritionalInfo: {
                              ...(newProduct.nutritionalInfo || {}),
                              servingsPerContainer: e.target.value
                            }
                          })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-700">Porção de / Medida caseira</label>
                        <input 
                          type="text" 
                          placeholder="Ex: 350 g (1 marmita inteira)"
                          className="w-full p-2 rounded-lg border border-gray-300 text-xs font-semibold bg-white text-black"
                          value={newProduct.nutritionalInfo?.servingSize || ''}
                          onChange={e => setNewProduct({
                            ...newProduct,
                            nutritionalInfo: {
                              ...(newProduct.nutritionalInfo || {}),
                              servingSize: e.target.value
                            }
                          })}
                        />
                      </div>
                    </div>

                    {/* Nutrients List */}
                    <div className="space-y-2">
                      <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] font-bold uppercase text-gray-500 px-1">
                        <div className="col-span-7">Nutriente</div>
                        <div className="col-span-3">Quantidade</div>
                        <div className="col-span-2 text-right">% VD*</div>
                      </div>

                      {/* 1. Valor Energético */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2 rounded-lg bg-white border border-gray-200">
                        <div className="col-span-7 text-xs font-bold text-gray-900">Valor energético (kcal)</div>
                        <div className="col-span-3">
                          <input 
                            type="text" 
                            placeholder="Ex: 350"
                            className="w-full p-1.5 rounded border border-gray-300 text-xs font-semibold bg-white text-black"
                            value={newProduct.nutritionalInfo?.calories || ''}
                            onChange={e => setNewProduct({
                              ...newProduct,
                              nutritionalInfo: { ...(newProduct.nutritionalInfo || {}), calories: e.target.value }
                            })}
                          />
                        </div>
                        <div className="col-span-2">
                          <input 
                            type="text" 
                            placeholder="%"
                            className="w-full p-1.5 rounded border border-gray-300 text-xs text-center font-semibold bg-white text-black"
                            value={newProduct.nutritionalInfo?.caloriesVd || ''}
                            onChange={e => setNewProduct({
                              ...newProduct,
                              nutritionalInfo: { ...(newProduct.nutritionalInfo || {}), caloriesVd: e.target.value }
                            })}
                          />
                        </div>
                      </div>

                      {/* 2. Carboidratos */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2 rounded-lg bg-white border border-gray-200">
                        <div className="col-span-7 text-xs font-bold text-gray-900">Carboidratos totais (g)</div>
                        <div className="col-span-3">
                          <input 
                            type="text" 
                            placeholder="Ex: 45"
                            className="w-full p-1.5 rounded border border-gray-300 text-xs font-semibold bg-white text-black"
                            value={newProduct.nutritionalInfo?.carbs || ''}
                            onChange={e => setNewProduct({
                              ...newProduct,
                              nutritionalInfo: { ...(newProduct.nutritionalInfo || {}), carbs: e.target.value }
                            })}
                          />
                        </div>
                        <div className="col-span-2">
                          <input 
                            type="text" 
                            placeholder="%"
                            className="w-full p-1.5 rounded border border-gray-300 text-xs text-center font-semibold bg-white text-black"
                            value={newProduct.nutritionalInfo?.carbsVd || ''}
                            onChange={e => setNewProduct({
                              ...newProduct,
                              nutritionalInfo: { ...(newProduct.nutritionalInfo || {}), carbsVd: e.target.value }
                            })}
                          />
                        </div>
                      </div>

                      {/* 3. Proteínas */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2 rounded-lg bg-white border border-gray-200">
                        <div className="col-span-7 text-xs font-bold text-gray-900">Proteínas (g)</div>
                        <div className="col-span-3">
                          <input 
                            type="text" 
                            placeholder="Ex: 18"
                            className="w-full p-1.5 rounded border border-gray-300 text-xs font-semibold bg-white text-black"
                            value={newProduct.nutritionalInfo?.proteins || ''}
                            onChange={e => setNewProduct({
                              ...newProduct,
                              nutritionalInfo: { ...(newProduct.nutritionalInfo || {}), proteins: e.target.value }
                            })}
                          />
                        </div>
                        <div className="col-span-2">
                          <input 
                            type="text" 
                            placeholder="%"
                            className="w-full p-1.5 rounded border border-gray-300 text-xs text-center font-semibold bg-white text-black"
                            value={newProduct.nutritionalInfo?.proteinsVd || ''}
                            onChange={e => setNewProduct({
                              ...newProduct,
                              nutritionalInfo: { ...(newProduct.nutritionalInfo || {}), proteinsVd: e.target.value }
                            })}
                          />
                        </div>
                      </div>

                      {/* 4. Gorduras totais */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2 rounded-lg bg-white border border-gray-200">
                        <div className="col-span-7 text-xs font-bold text-gray-900">Gorduras totais (g)</div>
                        <div className="col-span-3">
                          <input 
                            type="text" 
                            placeholder="Ex: 8"
                            className="w-full p-1.5 rounded border border-gray-300 text-xs font-semibold bg-white text-black"
                            value={newProduct.nutritionalInfo?.totalFat || ''}
                            onChange={e => setNewProduct({
                              ...newProduct,
                              nutritionalInfo: { ...(newProduct.nutritionalInfo || {}), totalFat: e.target.value }
                            })}
                          />
                        </div>
                        <div className="col-span-2">
                          <input 
                            type="text" 
                            placeholder="%"
                            className="w-full p-1.5 rounded border border-gray-300 text-xs text-center font-semibold bg-white text-black"
                            value={newProduct.nutritionalInfo?.totalFatVd || ''}
                            onChange={e => setNewProduct({
                              ...newProduct,
                              nutritionalInfo: { ...(newProduct.nutritionalInfo || {}), totalFatVd: e.target.value }
                            })}
                          />
                        </div>
                      </div>

                      {/* 5. Gorduras saturadas */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2 rounded-lg bg-white border border-gray-200 pl-4 border-l-4 border-l-amber-500">
                        <div className="col-span-7 text-xs font-medium text-gray-800">↳ Gorduras saturadas (g)</div>
                        <div className="col-span-3">
                          <input 
                            type="text" 
                            placeholder="Ex: 2"
                            className="w-full p-1.5 rounded border border-gray-300 text-xs font-semibold bg-white text-black"
                            value={newProduct.nutritionalInfo?.saturatedFat || ''}
                            onChange={e => setNewProduct({
                              ...newProduct,
                              nutritionalInfo: { ...(newProduct.nutritionalInfo || {}), saturatedFat: e.target.value }
                            })}
                          />
                        </div>
                        <div className="col-span-2">
                          <input 
                            type="text" 
                            placeholder="%"
                            className="w-full p-1.5 rounded border border-gray-300 text-xs text-center font-semibold bg-white text-black"
                            value={newProduct.nutritionalInfo?.saturatedFatVd || ''}
                            onChange={e => setNewProduct({
                              ...newProduct,
                              nutritionalInfo: { ...(newProduct.nutritionalInfo || {}), saturatedFatVd: e.target.value }
                            })}
                          />
                        </div>
                      </div>

                      {/* 6. Gorduras trans */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2 rounded-lg bg-white border border-gray-200 pl-4 border-l-4 border-l-orange-400">
                        <div className="col-span-7 text-xs font-medium text-gray-800">↳ Gorduras trans (g)</div>
                        <div className="col-span-3">
                          <input 
                            type="text" 
                            placeholder="Ex: 0"
                            className="w-full p-1.5 rounded border border-gray-300 text-xs font-semibold bg-white text-black"
                            value={newProduct.nutritionalInfo?.transFat || ''}
                            onChange={e => setNewProduct({
                              ...newProduct,
                              nutritionalInfo: { ...(newProduct.nutritionalInfo || {}), transFat: e.target.value }
                            })}
                          />
                        </div>
                        <div className="col-span-2">
                          <input 
                            type="text" 
                            placeholder="%"
                            className="w-full p-1.5 rounded border border-gray-300 text-xs text-center font-semibold bg-white text-black"
                            value={newProduct.nutritionalInfo?.transFatVd || ''}
                            onChange={e => setNewProduct({
                              ...newProduct,
                              nutritionalInfo: { ...(newProduct.nutritionalInfo || {}), transFatVd: e.target.value }
                            })}
                          />
                        </div>
                      </div>

                      {/* 7. Fibra alimentar */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2 rounded-lg bg-white border border-gray-200">
                        <div className="col-span-7 text-xs font-bold text-gray-900">Fibra alimentar (g)</div>
                        <div className="col-span-3">
                          <input 
                            type="text" 
                            placeholder="Ex: 6"
                            className="w-full p-1.5 rounded border border-gray-300 text-xs font-semibold bg-white text-black"
                            value={newProduct.nutritionalInfo?.fiber || ''}
                            onChange={e => setNewProduct({
                              ...newProduct,
                              nutritionalInfo: { ...(newProduct.nutritionalInfo || {}), fiber: e.target.value }
                            })}
                          />
                        </div>
                        <div className="col-span-2">
                          <input 
                            type="text" 
                            placeholder="%"
                            className="w-full p-1.5 rounded border border-gray-300 text-xs text-center font-semibold bg-white text-black"
                            value={newProduct.nutritionalInfo?.fiberVd || ''}
                            onChange={e => setNewProduct({
                              ...newProduct,
                              nutritionalInfo: { ...(newProduct.nutritionalInfo || {}), fiberVd: e.target.value }
                            })}
                          />
                        </div>
                      </div>

                      {/* 8. Sódio */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2 rounded-lg bg-white border border-gray-200">
                        <div className="col-span-7 text-xs font-bold text-gray-900">Sódio (mg)</div>
                        <div className="col-span-3">
                          <input 
                            type="text" 
                            placeholder="Ex: 140"
                            className="w-full p-1.5 rounded border border-gray-300 text-xs font-semibold bg-white text-black"
                            value={newProduct.nutritionalInfo?.sodium || ''}
                            onChange={e => setNewProduct({
                              ...newProduct,
                              nutritionalInfo: { ...(newProduct.nutritionalInfo || {}), sodium: e.target.value }
                            })}
                          />
                        </div>
                        <div className="col-span-2">
                          <input 
                            type="text" 
                            placeholder="%"
                            className="w-full p-1.5 rounded border border-gray-300 text-xs text-center font-semibold bg-white text-black"
                            value={newProduct.nutritionalInfo?.sodiumVd || ''}
                            onChange={e => setNewProduct({
                              ...newProduct,
                              nutritionalInfo: { ...(newProduct.nutritionalInfo || {}), sodiumVd: e.target.value }
                            })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 4: CONTROLE DE ESTOQUE & PRONTA ENTREGA */}
              <div className="bg-white/80 rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
                <div className="w-full p-4 md:p-5 flex items-center justify-between bg-gray-50/70 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-black">4</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">Controle de Estoque & Pronta Entrega</span>
                        {newProduct.trackStock && (
                          <span className="text-[10px] uppercase font-black bg-[#00753A] text-white px-2.5 py-0.5 rounded-full shadow-2xs">
                            Pronta Entrega Ativa
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Defina a quantidade de unidades disponíveis para pronta entrega imediata deste prato.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-4 bg-white/40">
                  <label className="flex items-start gap-3 cursor-pointer p-3.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors">
                    <input 
                      type="checkbox"
                      id="product-track-stock-checkbox"
                      checked={!!newProduct.trackStock}
                      onChange={e => setNewProduct({ 
                        ...newProduct, 
                        trackStock: e.target.checked,
                        stockQuantity: e.target.checked ? (typeof newProduct.stockQuantity === 'number' && newProduct.stockQuantity > 0 ? newProduct.stockQuantity : 10) : 0
                      })}
                      className="w-5 h-5 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 cursor-pointer"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-bold text-gray-900 block">
                        Controlar estoque deste prato (Disponível para Pronta Entrega)
                      </span>
                      <span className="text-xs text-gray-500 block mt-0.5">
                        Ao marcar esta opção, o prato exibirá a etiqueta verde <strong>PRONTA ENTREGA</strong> no cardápio e a quantidade disponível para os clientes.
                      </span>
                    </div>
                  </label>

                  {newProduct.trackStock && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="p-4 sm:p-5 rounded-2xl bg-emerald-50/40 border border-emerald-200/80 space-y-4"
                    >
                      <div>
                        <label className="text-[11px] font-black uppercase tracking-wider text-emerald-950 block mb-2">
                          Quantidade Disponível para Pronta Entrega (Unidades em Estoque) *
                        </label>
                        <div className="flex items-center gap-3 max-w-sm">
                          <input 
                            type="number"
                            id="product-stock-quantity-input"
                            min="0"
                            value={newProduct.stockQuantity !== undefined ? newProduct.stockQuantity : ''}
                            onChange={e => setNewProduct({ 
                              ...newProduct, 
                              stockQuantity: Math.max(0, parseInt(e.target.value, 10) || 0) 
                            })}
                            placeholder="0"
                            className="w-32 p-3 text-center text-lg font-black rounded-xl border border-emerald-300 bg-white text-emerald-950 focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm"
                          />
                          <span className="text-sm text-emerald-900 font-bold">unidades prontas</span>
                        </div>
                      </div>

                      <div className="p-3.5 bg-amber-50/90 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1 shadow-2xs">
                        <div className="flex items-center gap-1.5 font-bold text-amber-900">
                          <Zap size={15} className="text-amber-600 fill-amber-500 shrink-0" />
                          <span>Baixa Automática em Tempo Real:</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-amber-800">
                          Conforme os clientes enviam pedidos com este prato pelo WhatsApp ou carrinho, a quantidade em estoque é abatida automaticamente no banco de dados. Quando chegar a 0 unidades, o item será marcado como <strong>ESGOTADO</strong> e impedirá novos pedidos até você reabastecer aqui.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button 
                  type="submit"
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold shadow-md hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  style={{ 
                    backgroundColor: settings?.primaryColor || '#865d39',
                    color: getContrastText(settings?.primaryColor || '#865d39')
                  }}
                >
                  {isEditingProduct ? <Save size={18} /> : <Plus size={18} />}
                  {isEditingProduct ? 'Salvar Alterações do Produto' : 'Adicionar Prato ao Cardápio'}
                </button>

                {isEditingProduct && (
                  <button 
                    type="button"
                    onClick={() => {
                      setIsEditingProduct(null);
                      setNewProduct({ 
                        title: '', description: '', price: 0, oldPrice: 0, priceType: 'fixed',
                        image: '', categoryId: '', isMeal: true, isCustomCake: false, isCustomSandwich: false, customFillings: '', ingredients: '', allowedSides: [], isActive: true,
                        hasSizes: false, sizes: [],
                        isCombo: false, comboQuantity: 5, comboAllowedProductIds: [],
                        isComboOnly: false,
                        nutritionalInfo: {
                          calories: '',
                          carbs: '',
                          proteins: '',
                          totalFat: '',
                          saturatedFat: '',
                          transFat: '',
                          fiber: '',
                          sodium: ''
                        },
                        trackStock: false,
                        stockQuantity: 0
                      });
                      setPriceInput('');
                      setOldPriceInput('');
                      setEditingSizeId(null);
                      setSizeForm({ name: '', price: '', oldPrice: '' });
                      setShowNutritionalForm(false);
                    }}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gray-200 hover:bg-gray-300 font-bold text-gray-800 cursor-pointer transition-all"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            <div className="glass p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative w-full md:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar produto pelo nome..."
                  className="w-full p-3 pl-10 rounded-xl border border-gray-300 bg-white text-black"
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={printAllProductsList}
                className="w-full md:w-auto px-6 py-3 rounded-xl bg-gray-900 hover:bg-slate-800 text-white font-bold flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <Printer size={18} /> Imprimir Todos os Produtos
              </button>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="text-center p-12 glass rounded-2xl">
                <p className="text-gray-500 font-bold text-black opacity-60">Nenhum produto encontrado com a pesquisa atual.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map(product => (
                  <motion.div 
                    layout
                    key={product.id} 
                    className={cn(
                      "bg-white rounded-2xl overflow-hidden flex flex-col border border-gray-200 shadow-sm hover:shadow-md transition-all text-gray-900",
                      product.isActive === false ? "opacity-60 grayscale" : ""
                    )}
                  >
                    <div className="h-48 relative">
                      <img src={product.image} alt={product.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute top-3 right-3 flex gap-2">
                        <button 
                           onClick={() => toggleProductStatus(product)}
                          className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm text-gray-700 hover:text-black"
                          title={product.isActive === false ? "Ativar" : "Desativar"}
                        >
                          {product.isActive === false ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                        <button 
                          onClick={() => {
                            setIsEditingProduct(product);
                            setNewProduct({
                              title: product.title,
                              description: product.description,
                              price: product.price,
                              oldPrice: product.oldPrice || 0,
                              priceType: product.priceType || 'fixed',
                              image: product.image,
                              categoryId: product.categoryId,
                              isMeal: product.isMeal || false,
                              isCustomCake: product.isCustomCake || false,
                              isCustomSandwich: product.isCustomSandwich || false,
                              customFillings: product.customFillings || '',
                              ingredients: product.ingredients || '',
                              allowedSides: product.allowedSides || [],
                              isActive: product.isActive ?? true,
                              hasSizes: product.hasSizes || false,
                              sizes: product.sizes || [],
                              cakeGalleryId: product.cakeGalleryId || '',
                              isCombo: product.isCombo || false,
                              comboQuantity: product.comboQuantity || 5,
                              comboAllowedProductIds: product.comboAllowedProductIds || [],
                              isComboOnly: product.isComboOnly || false,
                              nutritionalInfo: product.nutritionalInfo || {
                                servingSize: '',
                                servingsPerContainer: '',
                                calories: '',
                                caloriesVd: '',
                                carbs: '',
                                carbsVd: '',
                                totalSugars: '',
                                totalSugarsVd: '',
                                addedSugars: '',
                                addedSugarsVd: '',
                                proteins: '',
                                proteinsVd: '',
                                totalFat: '',
                                totalFatVd: '',
                                saturatedFat: '',
                                saturatedFatVd: '',
                                transFat: '',
                                transFatVd: '',
                                fiber: '',
                                fiberVd: '',
                                sodium: '',
                                sodiumVd: ''
                              },
                              trackStock: product.trackStock ?? false,
                              stockQuantity: typeof product.stockQuantity === 'number' ? product.stockQuantity : 0
                            });
                            setPriceInput(product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
                            setEditingSizeId(null);
                            setSizeForm({ name: '', price: '', oldPrice: '' });
                            setOldPriceInput(product.oldPrice ? product.oldPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
                            if (product.nutritionalInfo && (product.nutritionalInfo.calories || product.nutritionalInfo.servingSize || product.nutritionalInfo.carbs)) {
                              setShowNutritionalForm(true);
                            } else {
                              setShowNutritionalForm(false);
                            }
                            scrollToTop();
                          }}
                          className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm text-blue-600"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => deleteProduct(product.id)}
                          className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm text-red-600"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                      {product.trackStock && (
                        <div className="absolute top-3 left-3">
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-md text-white",
                            (product.stockQuantity ?? 0) > 0 ? "bg-[#00753A]" : "bg-red-600"
                          )}>
                            {(product.stockQuantity ?? 0) > 0 ? "Pronta Entrega" : "Esgotado"}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-5 flex-grow flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-serif font-bold text-lg text-gray-900">{product.title}</h4>
                          {product.trackStock && (
                            <span className={cn(
                              "inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border mt-1",
                              (product.stockQuantity ?? 0) > 0
                                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                : "bg-red-50 text-red-700 border-red-300"
                            )}>
                              <Zap size={10} className={(product.stockQuantity ?? 0) > 0 ? "text-emerald-600 fill-emerald-600" : "text-red-500"} />
                              <span>{product.stockQuantity ?? 0} unidades em estoque</span>
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col items-end">
                          {product.sizes && product.sizes.length > 0 ? (
                            <>
                              <span className="text-[10px] font-bold uppercase opacity-40">Tamanhos múltiplos</span>
                              <span className="font-bold text-blue-600">
                                A partir de: {currencySymbol} {Math.min(...product.sizes.map(s => s.price)).toFixed(2).replace('.', ',')}
                              </span>
                            </>
                          ) : (
                            <>
                              {Boolean(product.price > 0 && product.oldPrice && product.oldPrice > 0) && (
                                <span className="text-xs line-through opacity-40">
                                  {currencySymbol} {product.oldPrice.toFixed(2).replace('.', ',')}
                                </span>
                              )}
                              <span className="font-bold text-blue-600">
                                {currencySymbol} {(product.price > 0 ? product.price : (product.oldPrice || 0)).toFixed(2).replace('.', ',')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{product.description}</p>
                      
                      {product.sizes && product.sizes.length > 0 && (
                        <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-xl text-[11px] space-y-1 mt-2 text-gray-900">
                          <span className="font-bold opacity-60">Tamanhos:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {product.sizes.map((s, idx) => (
                              <span key={idx} className="bg-white/70 px-2 py-0.5 rounded border border-black/5 font-medium text-black">
                                {s.name} ({currencySymbol} {s.price.toFixed(2).replace('.', ',')})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {product.isCombo && (
                        <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-[11px] space-y-1 mt-2 text-amber-950">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-amber-950 flex items-center gap-1">
                              🍱 Combo ({product.comboQuantity || 5} marmitas)
                            </span>
                            <span className="text-[10px] text-amber-800 font-bold">
                              {product.comboAllowedProductIds && product.comboAllowedProductIds.length > 0
                                ? `${product.comboAllowedProductIds.length} prato(s) permitidos`
                                : 'Todos pratos liberados'}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-auto pt-3 flex items-center justify-between border-t border-black/5">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-40">
                          {categories.find(c => c.id === product.categoryId)?.title || 'Sem categoria'}
                        </span>
                        <div className="flex gap-1.5">
                          {product.isComboOnly && (
                            <span className="px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold rounded-full uppercase">
                              Apenas p/ Combo (Oculto avulso)
                            </span>
                          )}
                          {product.isMeal && (
                            <span className="px-2 py-1 bg-green-50 text-green-600 text-[10px] font-bold rounded-full uppercase">
                              Opções de Personalização
                            </span>
                          )}
                          {product.sizes && product.sizes.length > 0 && (
                            <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full uppercase">
                              Múltiplos Tamanhos
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80 space-y-6 text-gray-900">
            {/* Top Bar: Title, Actions & View Mode Switcher */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200/60 shadow-2xs">
                  <Calendar size={26} className="text-emerald-700 stroke-[2]" />
                </div>
                <div>
                  <h2 className="text-2xl font-serif font-bold text-gray-900 leading-tight">Cronograma de Entregas & Retiradas</h2>
                  <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mt-0.5">VISUALIZAÇÃO DINÂMICA DOS PEDIDOS AGENDADOS</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* View Mode Selector Tabs */}
                <div className="flex items-center gap-1 p-1 bg-gray-100/90 rounded-2xl border border-gray-200/80">
                  <button
                    type="button"
                    onClick={() => setOrderViewMode('week')}
                    className={cn(
                      "px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer",
                      orderViewMode === 'week'
                        ? "bg-white text-gray-900 shadow-sm border border-gray-200/80"
                        : "text-gray-600 hover:text-gray-900"
                    )}
                  >
                    Semana (7 Colunas)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderViewMode('list')}
                    className={cn(
                      "px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer",
                      orderViewMode === 'list'
                        ? "bg-white text-gray-900 shadow-sm border border-gray-200/80"
                        : "text-gray-600 hover:text-gray-900"
                    )}
                  >
                    Lista Detalhada
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderViewMode('month')}
                    className={cn(
                      "px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer",
                      orderViewMode === 'month'
                        ? "bg-white text-gray-900 shadow-sm border border-gray-200/80"
                        : "text-gray-600 hover:text-gray-900"
                    )}
                  >
                    Mensal
                  </button>
                </div>

                {/* Calendar Navigation (when in week or month mode) */}
                {(orderViewMode === 'week' || orderViewMode === 'month') && (
                  <div className="flex items-center gap-1 bg-gray-100/90 rounded-2xl border border-gray-200/80 p-1">
                    <button
                      onClick={() => {
                        const d = new Date(calendarDate);
                        if (orderViewMode === 'week') d.setDate(d.getDate() - 7);
                        else d.setMonth(d.getMonth() - 1);
                        setCalendarDate(d);
                      }}
                      className="p-1.5 rounded-lg text-gray-700 hover:bg-white hover:text-black transition-all cursor-pointer"
                      title="Período Anterior"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setCalendarDate(new Date())}
                      className="px-3 py-1.5 rounded-lg text-gray-800 font-bold text-xs hover:bg-white transition-all cursor-pointer"
                    >
                      Hoje
                    </button>
                    <button
                      onClick={() => {
                        const d = new Date(calendarDate);
                        if (orderViewMode === 'week') d.setDate(d.getDate() + 7);
                        else d.setMonth(d.getMonth() + 1);
                        setCalendarDate(d);
                      }}
                      className="p-1.5 rounded-lg text-gray-700 hover:bg-white hover:text-black transition-all cursor-pointer"
                      title="Próximo Período"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    placeholder="Filtrar cliente..."
                    value={orderSearch}
                    onChange={e => setOrderSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 font-medium focus:outline-none focus:ring-2 focus:ring-black/10 w-36 sm:w-44"
                  />
                  {orderSearch && (
                    <button
                      onClick={() => setOrderSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <button 
                  onClick={() => {
                    setManualOrderForm({
                      customerName: '',
                      phone: '',
                      email: '',
                      address: '',
                      street: '',
                      number: '',
                      zipCode: '',
                      city: '',
                      pickupDate: '',
                      observation: '',
                      birthday: ''
                    });
                    setManualOrderItems([]);
                    setOrderCustomerSearch('');
                    setIsAddingOrder(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs text-white bg-green-600 hover:bg-green-700 shadow-sm transition-all cursor-pointer"
                >
                  <Plus size={16} /> Adicionar Pedido
                </button>

                {orderViewMode === 'list' && (
                  <>
                    {showBatchSummary ? (
                      <button 
                        onClick={printProductionSummary}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs bg-green-600 text-white hover:bg-green-700 transition-all shadow-sm cursor-pointer"
                      >
                        <Printer size={16} /> Imprimir Resumo
                      </button>
                    ) : (
                      <button 
                        onClick={printOrdersList}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs bg-green-600 text-white hover:bg-green-700 transition-all shadow-sm cursor-pointer"
                      >
                        <Printer size={16} /> Imprimir Lista
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Current Range Label Banner */}
            {(orderViewMode === 'week' || orderViewMode === 'month') && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-gray-100">
                <div className="text-base font-bold text-gray-900 font-serif">
                  {orderViewMode === 'week' 
                    ? `Semana de ${weekDays[0].getDate()} a ${weekDays[6].getDate()} de ${MONTH_NAMES_PT[weekDays[6].getMonth()]} de ${weekDays[6].getFullYear()}`
                    : `${MONTH_NAMES_PT[calendarDate.getMonth()]} de ${calendarDate.getFullYear()}`}
                </div>
                <div className="px-3.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-200/80 uppercase tracking-wide flex items-center gap-1.5 self-start sm:self-auto shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
                  <span>
                    {orderViewMode === 'week' ? weekOrdersCount : monthOrdersCount} {((orderViewMode === 'week' ? weekOrdersCount : monthOrdersCount) === 1) ? 'PEDIDO NO PERÍODO' : 'PEDIDOS NO PERÍODO'}
                  </span>
                </div>
              </div>
            )}

            {/* VIEW 1: WEEKLY VIEW (7 COLUMNS) */}
            {orderViewMode === 'week' && (
              <div className="grid grid-cols-1 md:grid-cols-7 border border-gray-200 rounded-2xl overflow-hidden bg-white divide-y md:divide-y-0 md:divide-x divide-gray-200 shadow-2xs min-h-[520px]">
                {weekDays.map((day, idx) => {
                  const dayOrders = getOrdersForDay(day);
                  const isTodayDay = isTodayCalendarDay(day);
                  const dayStrBR = `${String(day.getDate()).padStart(2, '0')}/${String(day.getMonth() + 1).padStart(2, '0')}`;
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "flex flex-col min-h-[420px] transition-all bg-white",
                        isTodayDay && "bg-blue-50/[0.15]"
                      )}
                    >
                      {/* Day Header */}
                      <div className={cn(
                        "p-3.5 text-center border-b border-gray-200 relative",
                        isTodayDay ? "bg-blue-50/40 border-b-2 border-b-blue-600" : "bg-gray-50/50"
                      )}>
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-800 block">
                          {WEEKDAYS_SHORT_PT[day.getDay()]}
                        </span>
                        
                        {isTodayDay ? (
                          <span className="px-3 py-0.5 rounded-full text-xs font-black text-white bg-blue-600 inline-flex items-center gap-1 my-1 shadow-xs">
                            {dayStrBR} HOJE
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold text-gray-700 bg-white border border-gray-200 inline-block my-1 shadow-2xs">
                            {dayStrBR}
                          </span>
                        )}

                        <span className="text-[11px] text-gray-500 font-medium block">
                          {dayOrders.length} {dayOrders.length === 1 ? 'pedido' : 'pedidos'}
                        </span>
                      </div>

                      {/* Orders list for this day */}
                      <div className="p-2.5 space-y-2.5 flex-1 min-h-[350px] bg-white flex flex-col justify-start overflow-y-auto max-h-[580px]">
                        {dayOrders.length === 0 ? (
                          <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center p-4 text-xs text-gray-400 font-medium gap-1.5 opacity-60">
                            <Clock size={16} className="text-gray-300 stroke-[1.5]" />
                            <span>Sem pedidos</span>
                          </div>
                        ) : (
                          dayOrders.map(order => {
                            const info = getOrderScheduledInfo(order);
                            const isDelivered = order.deliveryStatus === 'delivered';
                            return (
                              <div
                                key={order.id}
                                onClick={() => setSelectedOrderModal(order)}
                                className={cn(
                                  "p-3 rounded-2xl cursor-pointer transition-all hover:shadow-md border text-left space-y-2 bg-white",
                                  isDelivered 
                                    ? "border-emerald-400" 
                                    : "border-emerald-300 hover:border-emerald-400"
                                )}
                              >
                                <div className="flex items-center justify-between gap-1 flex-wrap">
                                  <span className={cn(
                                    "text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md flex items-center gap-1 tracking-wide",
                                    isDelivered
                                      ? "bg-emerald-600 text-white"
                                      : "bg-emerald-600 text-white"
                                  )}>
                                    {isDelivered ? '✓ ENTREGUE' : '✓ ENTREGUE'}
                                  </span>
                                  {order.wantsReadyDelivery && (
                                    <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-300">
                                      <Zap size={10} className="text-amber-600 fill-amber-500" />
                                      Pronta Entrega
                                    </span>
                                  )}
                                </div>

                                <div className="text-xs font-bold text-gray-700 flex items-center gap-1">
                                  <Clock size={12} className="text-emerald-700" />
                                  <span>{info.timeStr ? `${info.timeStr}` : '06:00 PM'}</span>
                                </div>

                                <div>
                                  <h4 className="font-bold text-sm leading-snug text-gray-900 line-clamp-1">
                                    {order.isB2B || order.isPJ ? (order.b2bCompanyName || order.customerName) : order.customerName}
                                  </h4>
                                </div>

                                <div className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">
                                  {order.items?.map(it => `${it.quantity}x ${it.title}`).join(', ')}
                                </div>

                                <div className="flex items-center justify-between pt-1.5 border-t border-gray-100 text-[11px]">
                                  <div>
                                    {order.paymentStatus === 'full' ? (
                                      <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                                        🟢 Pago
                                      </span>
                                    ) : order.paymentStatus === 'half' ? (
                                      <span className="font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                        🟡 50%
                                      </span>
                                    ) : (
                                      <span className="font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md">
                                        🔴 Pendente
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-extrabold text-sm text-gray-900">
                                    {currencySymbol} {order.total.toFixed(2).replace('.', ',')}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* VIEW 2: MONTHLY VIEW */}
            {orderViewMode === 'month' && (
              <div className="glass p-4 sm:p-6 rounded-3xl space-y-4">
                <div className="grid grid-cols-7 gap-2 text-center pb-2 border-b border-black/10">
                  {WEEKDAYS_SHORT_PT.map((w, i) => (
                    <div key={i} className="text-xs font-extrabold uppercase text-gray-700 py-1">
                      {w}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {monthDays.map((item, idx) => {
                    const dayOrders = getOrdersForDay(item.date);
                    const isTodayDay = isTodayCalendarDay(item.date);
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "min-h-[110px] rounded-xl p-2 border transition-all flex flex-col justify-between",
                          item.isCurrentMonth ? "bg-white/80 border-gray-200" : "bg-black/[0.02] border-transparent opacity-40",
                          isTodayDay && "ring-2 ring-blue-500 border-blue-500 bg-blue-50/50 shadow-md"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={cn(
                            "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full",
                            isTodayDay ? "bg-blue-600 text-white font-black" : "text-gray-700"
                          )}>
                            {item.date.getDate()}
                          </span>
                          {dayOrders.length > 0 && (
                            <span className="text-[9px] font-extrabold bg-black/10 text-black px-1.5 py-0.5 rounded-full">
                              {dayOrders.length}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 overflow-y-auto max-h-[85px]">
                          {dayOrders.slice(0, 3).map(order => (
                            <div
                              key={order.id}
                              onClick={() => setSelectedOrderModal(order)}
                              className={cn(
                                "p-1 rounded text-[10px] truncate cursor-pointer transition-all hover:scale-105 font-medium border flex items-center justify-between gap-1",
                                order.deliveryStatus === 'delivered'
                                  ? "bg-emerald-100 border-emerald-300 text-emerald-900"
                                  : "bg-amber-50 border-amber-200 text-amber-900"
                              )}
                              title={`${order.customerName} - ${currencySymbol} ${order.total.toFixed(2)}`}
                            >
                              <span className="truncate">
                                {order.deliveryStatus === 'delivered' ? '✓' : '⏳'} {order.customerName}
                              </span>
                              <span className="font-bold flex-shrink-0 text-[9px]">
                                {currencySymbol}{Math.round(order.total)}
                              </span>
                            </div>
                          ))}
                          {dayOrders.length > 3 && (
                            <div 
                              onClick={() => {
                                setCalendarDate(item.date);
                                setOrderViewMode('week');
                              }}
                              className="text-[9px] text-center font-bold text-blue-600 cursor-pointer hover:underline"
                            >
                              +{dayOrders.length - 3} mais (ver semana)
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* VIEW 3: DETAILED LIST & FILTERS */}
            {orderViewMode === 'list' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-black/60" size={18} />
                    <input 
                      type="text" 
                      placeholder="DD/MM/AAAA"
                      className="pl-10 p-2 rounded-xl border-2 border-white bg-white/70 text-black font-semibold text-sm w-32 placeholder-black/50 focus:outline-none focus:ring-2 focus:ring-white"
                      value={startDate}
                      onChange={e => {
                        let val = e.target.value.replace(/\D/g, '');
                        if (val.length > 8) val = val.slice(0, 8);
                        if (val.length > 4) val = val.slice(0, 2) + '/' + val.slice(2, 4) + '/' + val.slice(4);
                        else if (val.length > 2) val = val.slice(0, 2) + '/' + val.slice(2);
                        setStartDate(val);
                      }}
                    />
                  </div>
                  <span className="text-white font-semibold drop-shadow-sm">até</span>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-black/60" size={18} />
                    <input 
                      type="text" 
                      placeholder="DD/MM/AAAA"
                      className="pl-10 p-2 rounded-xl border-2 border-white bg-white/70 text-black font-semibold text-sm w-32 placeholder-black/50 focus:outline-none focus:ring-2 focus:ring-white"
                      value={endDate}
                      onChange={e => {
                        let val = e.target.value.replace(/\D/g, '');
                        if (val.length > 8) val = val.slice(0, 8);
                        if (val.length > 4) val = val.slice(0, 2) + '/' + val.slice(2, 4) + '/' + val.slice(4);
                        else if (val.length > 2) val = val.slice(0, 2) + '/' + val.slice(2);
                        setEndDate(val);
                      }}
                    />
                  </div>
                  <button 
                    onClick={() => {
                      setShowBatchSummary(false);
                      setStartDate('');
                      setEndDate('');
                      setSelectedHistoryCatalog('all');
                      setFilterValidatedOnly(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all cursor-pointer",
                      (selectedHistoryCatalog === 'all' && !startDate && !endDate && !showBatchSummary && !filterValidatedOnly) 
                        ? "bg-gray-800 text-white shadow-md" 
                        : "bg-white border border-gray-300 text-gray-600"
                    )}
                  >
                    <History size={18} /> Todos os Pedidos
                  </button>
                  <button 
                    onClick={() => {
                      setShowBatchSummary(false);
                      setFilterValidatedOnly(!filterValidatedOnly);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all cursor-pointer",
                      filterValidatedOnly 
                        ? "bg-blue-600 text-white shadow-md font-extrabold ring-2 ring-blue-300" 
                        : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <CheckCircle2 size={18} className={filterValidatedOnly ? "text-white" : "text-blue-500"} /> Pedidos Validados
                  </button>
                  {settings?.catalog1Active !== false && (
                    <button 
                      onClick={() => {
                        setShowBatchSummary(false);
                        setSelectedHistoryCatalog('catalog1');
                      }}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all cursor-pointer",
                        (selectedHistoryCatalog === 'catalog1' && !showBatchSummary) 
                          ? "bg-gray-800 text-white shadow-md" 
                          : "bg-white border border-gray-300 text-gray-600"
                      )}
                    >
                      {settings?.catalog1Title || 'Catálogo 1'}
                    </button>
                  )}

                  <button 
                    onClick={() => {
                      if (!startDate || !endDate) {
                        toast.error('Por favor, selecione um intervalo de datas primeiro.');
                        return;
                      }
                      setShowBatchSummary(!showBatchSummary);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all",
                      showBatchSummary ? "bg-blue-600 text-white shadow-md" : "bg-white border border-gray-300 text-gray-600"
                    )}
                  >
                    <Layers size={18} /> Resumo de Produção
                  </button>
                </div>

            <div className="glass p-4 rounded-2xl">
              <input 
                type="text" 
                placeholder="Buscar por nome do cliente..."
                className="w-full p-3 rounded-xl border border-gray-300"
                value={orderSearch}
                onChange={e => setOrderSearch(e.target.value)}
              />
            </div>

            {showBatchSummary ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="glass p-6 rounded-2xl space-y-4">
                  <h3 className="text-xl font-serif font-bold flex items-center gap-2">
                    <Package size={20} className="text-blue-600" />
                    Total de Itens
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(batchSummary.items).length > 0 ? (
                      Object.entries(batchSummary.items).map(([title, qty]) => (
                        <div key={title} className="flex justify-between items-center p-3 bg-white/50 rounded-xl border border-white/20">
                          <span className="font-bold">{title}</span>
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-bold">{qty}x</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center opacity-40 py-4">Nenhum item no período</p>
                    )}
                  </div>
                </div>

                <div className="glass p-6 rounded-2xl space-y-4">
                  <h3 className="text-xl font-serif font-bold flex items-center gap-2">
                    <Plus size={20} className="text-green-600" />
                    Total de Acompanhamentos
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(batchSummary.sides).length > 0 ? (
                      Object.entries(batchSummary.sides).map(([name, qty]) => (
                        <div key={name} className="flex justify-between items-center p-3 bg-white/50 rounded-xl border border-white/20">
                          <span className="font-bold">{name}</span>
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-bold">{qty}x</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center opacity-40 py-4">Nenhum acompanhamento no período</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map(order => (
                <motion.div 
                  layout
                  key={order.id} 
                  id={`order-${order.id}`}
                  className="glass p-6 rounded-2xl space-y-4 border border-white/20"
                >
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-serif font-bold">
                          {order.isB2B || order.isPJ 
                            ? (order.b2bCompanyName || order.customerName)
                            : order.customerName
                          }
                        </h3>
                        {(order.isB2B || order.isPJ) && (
                          <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-black rounded-full flex items-center gap-1 border border-amber-200 uppercase tracking-widest animate-pulse">
                            ★ Corporativo PJ
                          </span>
                        )}
                        {isBirthdayThisWeek(order.birthday, order.orderLanguage) && (
                          <span className="px-3 py-1 bg-pink-100 text-pink-600 text-xs font-bold rounded-full flex items-center gap-1">
                            <Cake size={12} /> Aniversariante! ({order.birthday})
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm opacity-60">
                        <a 
                          href={`https://wa.me/${getCleanWhatsAppPhone(order.phone)}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:text-green-600 transition-colors font-bold text-black"
                        >
                          <MessageCircle size={14} className="text-green-600" /> {order.phone}
                        </a>
                        <span className="flex items-center gap-1"><Calendar size={14} /> Criado em: {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString('en-US') : 'N/A'}</span>
                        {order.pickupDate && (
                          <span 
                            className="flex items-center gap-1.5 font-black px-3 py-1 rounded-xl shadow-sm text-xs"
                            style={{ 
                              backgroundColor: settings?.primaryColor || '#865d39',
                              color: getContrastText(settings?.primaryColor || '#865d39')
                            }}
                          >
                            🚚 Agendado para: {order.pickupDate}
                          </span>
                        )}
                        {order.wantsReadyDelivery && (
                          <span className="flex items-center gap-1.5 font-black px-3 py-1 rounded-xl shadow-sm text-xs bg-amber-100 text-amber-900 border border-amber-300">
                            <Zap size={13} className="text-amber-600 fill-amber-500" />
                            ⚡ Pronta Entrega para Hoje (Sob Consulta)
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 mt-2">
                        <span className="text-xs font-bold text-gray-500 mr-1 uppercase">Sinalizar Pagamento:</span>
                        <button
                          onClick={() => updateOrderPaymentStatus(order.id, 'pending')}
                          className={cn(
                            "px-2.5 py-1 text-xs font-bold rounded-lg transition-all border cursor-pointer",
                            (!order.paymentStatus || order.paymentStatus === 'pending')
                              ? "bg-red-50 text-red-700 border-red-300 shadow-sm"
                              : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                          )}
                        >
                          ❌ Não Recebido
                        </button>
                        <button
                          onClick={() => updateOrderPaymentStatus(order.id, 'half')}
                          className={cn(
                            "px-2.5 py-1 text-xs font-bold rounded-lg transition-all border flex items-center gap-1 cursor-pointer",
                            order.paymentStatus === 'half'
                              ? "bg-amber-100 text-amber-800 border-amber-400 shadow-sm font-extrabold ring-2 ring-amber-200"
                              : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                          )}
                        >
                          ⏳ 50% Recebido
                        </button>
                        <button
                          onClick={() => updateOrderPaymentStatus(order.id, 'full')}
                          className={cn(
                            "px-2.5 py-1 text-xs font-bold rounded-lg transition-all border flex items-center gap-1 cursor-pointer",
                            order.paymentStatus === 'full'
                              ? "bg-green-100 text-green-800 border-green-400 shadow-sm font-extrabold ring-2 ring-green-200"
                              : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                          )}
                        >
                          ✅ Valor Integral
                        </button>
                        {(order.paymentStatus === 'half' || order.paymentStatus === 'full') && (
                          <span className="ml-1 px-2.5 py-1 text-xs font-black bg-blue-600 text-white rounded-lg uppercase tracking-wider animate-pulse shadow-md">
                            🚀 Validado para Produção
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-4 w-full">
                      <div className="flex flex-wrap items-center gap-2">
                        <button 
                          onClick={() => printOrder(order)}
                          className="p-3 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 shadow-sm"
                          title="Imprimir Comanda"
                        >
                          <Printer size={20} />
                        </button>
                        <button 
                          onClick={() => {
                            setIsEditingOrder(order);
                            setEditOrderForm({ ...order, phone: formatBRPhone(order.phone || '') });
                          }}
                          className="p-3 bg-white border border-gray-200 rounded-xl text-blue-600 hover:bg-blue-50 shadow-sm"
                        >
                          <Edit2 size={20} />
                        </button>
                        <button 
                          onClick={() => deleteOrder(order.id)}
                          className="p-3 bg-white border border-gray-200 rounded-xl text-red-600 hover:bg-red-50 shadow-sm"
                        >
                          <Trash2 size={20} />
                        </button>
                        <button 
                          onClick={() => toggleOrder(order.id)}
                          className="p-3 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 shadow-sm transition-all"
                          title={expandedOrders.includes(order.id) ? "Recolher" : "Expandir"}
                        >
                          {expandedOrders.includes(order.id) ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold uppercase opacity-40">
                          Total do Pedido
                        </div>
                        <div className="text-xl font-extrabold" style={{ color: settings?.primaryColor || '#865d39' }}>
                          {currencySymbol} {order.total.toFixed(2).replace('.', ',')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedOrders.includes(order.id) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-4"
                      >
                        <div className="bg-white/30 rounded-xl p-4 space-y-3">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-start border-b border-black/5 last:border-0 pb-2 last:pb-0">
                              <div className="space-y-1">
                                <div className="font-bold">{item.quantity}x {item.title}{item.selectedSize ? ` (${item.selectedSize.name})` : ''}</div>
                                {item.cakeOptions && (
                                  <div className="text-xs opacity-60 space-y-0.5">
                                    {item.cakeOptions.size && <div><span className="font-bold">Tamanho:</span> {item.cakeOptions.size}</div>}
                                    {item.cakeOptions.dough && <div><span className="font-bold">Massa:</span> {item.cakeOptions.dough}</div>}
                                    {item.cakeOptions.fillings && item.cakeOptions.fillings.length > 0 && (
                                      <div><span className="font-bold">Recheios:</span> {item.cakeOptions.fillings.join(', ')}</div>
                                    )}
                                    {item.cakeOptions.topping && <div><span className="font-bold">Cobertura:</span> {item.cakeOptions.topping}</div>}
                                    {item.cakeOptions.topper && <div><span className="font-bold">Topper:</span> {item.cakeOptions.topper}</div>}
                                  </div>
                                )}
                                {item.sandwichOptions && item.sandwichOptions.fillings && item.sandwichOptions.fillings.length > 0 && (
                                  <div className="text-xs opacity-60">
                                    <div><span className="font-bold">Recheios:</span> {item.sandwichOptions.fillings.join(', ')}</div>
                                  </div>
                                )}
                                {item.mealOptions && (
                                  <div className="text-xs opacity-60 space-y-1">
                                    {item.mealOptions.removals.length > 0 && (
                                      <div><span className="font-bold">Remover:</span> {item.mealOptions.removals.join(', ')}</div>
                                    )}
                                    {item.mealOptions.sides.length > 0 && (
                                      <div><span className="font-bold">Acompanhamentos:</span> {item.mealOptions.sides.map(s => s.name).join(', ')}</div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="font-bold opacity-60">{currencySymbol} {(item.price * item.quantity).toFixed(2).replace('.', ',')}</div>
                            </div>
                          ))}
                          
                          {order.total > 0 && !(order.isB2B || order.isPJ) && (
                            <div className="border-t border-black/10 pt-3 mt-3 space-y-1.5 text-xs text-black font-semibold">
                              {(order.taxAmount && order.taxAmount > 0) ? (
                                <>
                                  <div className="flex justify-between">
                                    <span className="opacity-60 font-medium">Subtotal:</span>
                                    <span>{currencySymbol} {(order.subtotal || (order.total - order.taxAmount)).toFixed(2).replace('.', ',')}</span>
                                  </div>
                                  <div className="flex justify-between text-amber-900">
                                    <span className="opacity-60 font-medium">Imposto ({order.taxRate || 8.25}%):</span>
                                    <span>+ {currencySymbol} {order.taxAmount.toFixed(2).replace('.', ',')}</span>
                                  </div>
                                  <div className="flex justify-between text-base font-extrabold border-t border-black/5 pt-1.5" style={{ color: settings?.primaryColor || '#865d39' }}>
                                    <span>Total com Imposto:</span>
                                    <span>{currencySymbol} {order.total.toFixed(2).replace('.', ',')}</span>
                                  </div>
                                </>
                              ) : (
                                <div className="space-y-1">
                                  {order.subtotal !== undefined && order.deliveryNeighborhood && (
                                    <div className="flex justify-between text-gray-500 font-medium">
                                      <span>Subtotal dos Itens:</span>
                                      <span>{currencySymbol} {order.subtotal.toFixed(2).replace('.', ',')}</span>
                                    </div>
                                  )}
                                  {order.deliveryNeighborhood && (
                                    <div className="flex justify-between text-blue-700 font-bold">
                                      <span>Taxa de Entrega ({order.deliveryNeighborhood}):</span>
                                      <span>{order.deliveryFee ? `+ ${currencySymbol} ${order.deliveryFee.toFixed(2).replace('.', ',')}` : 'A combinar'}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between text-base font-extrabold pt-1.5 border-t border-black/5" style={{ color: settings?.primaryColor || '#865d39' }}>
                                    <span>Total:</span>
                                    <span>{currencySymbol} {order.total.toFixed(2).replace('.', ',')}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                          <div className="space-y-1">
                            <div className="font-bold uppercase opacity-40 text-[10px]">
                              {(order.isB2B || order.isPJ) ? "Endereço Comercial / Entrega" : "Endereço de Entrega/Retirada"}
                            </div>
                            <div className="p-3 bg-white/50 rounded-lg border border-white/20 font-medium">
                              {order.b2bAddress || order.address}
                            </div>
                          </div>

                          {order.deliveryNeighborhood && (
                            <div className="space-y-1">
                              <div className="font-bold uppercase opacity-40 text-[10px]">
                                Bairro e Taxa de Entrega
                              </div>
                              <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-200/80 font-bold text-blue-900 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  <MapPin size={15} className="text-blue-600 shrink-0" />
                                  <span>{order.deliveryNeighborhood}</span>
                                </span>
                                <span className="text-xs bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full shrink-0 font-extrabold">
                                  Taxa: {order.deliveryFee ? `${currencySymbol} ${order.deliveryFee.toFixed(2).replace('.', ',')}` : 'A combinar'}
                                </span>
                              </div>
                            </div>
                          )}

                          {(order.isB2B || order.isPJ) ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <div className="font-bold uppercase opacity-40 text-[10px]">Responsável / Contato</div>
                                  <div className="p-2.5 bg-black/5 rounded-lg border border-black/10 font-bold text-black">{order.b2bManagerName || 'N/A'}</div>
                                </div>
                                <div className="space-y-1">
                                  <div className="font-bold uppercase opacity-40 text-[10px]">Frequência do Plano</div>
                                  <div className="p-2.5 bg-amber-500/10 text-amber-900 rounded-lg border border-amber-500/20 font-extrabold uppercase text-xs flex items-center justify-center text-center">
                                    {order.b2bFrequency === 'weekly' ? '🔄 Semanal' : '📦 Avulso'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : null}

                          <div className="space-y-1 md:col-span-2">
                            <div className="font-bold uppercase opacity-40 text-[10px]">Observações / Requisitos Especiais</div>
                            <div className="p-3 bg-white/50 rounded-lg border border-white/20 italic">
                              {order.observation || 'Nenhuma observação informada.'}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
              {filteredOrders.length === 0 && (
                <div className="glass p-12 rounded-2xl text-center text-gray-500">
                  Nenhum pedido encontrado com os filtros aplicados.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* POPUP MODAL FOR SELECTED ORDER (FROM CALENDAR / LIST) */}
      <AnimatePresence>
        {selectedOrderModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-100"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-900 flex items-center justify-center font-serif font-black text-lg shadow-sm border border-amber-500/20">
                    #
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-lg text-gray-900 leading-tight">
                      Detalhes do Pedido
                    </h3>
                    <p className="text-xs text-gray-500 font-mono font-medium mt-0.5">
                      ID: {selectedOrderModal.id} • Criado em {formatOrderFullDate(selectedOrderModal.createdAt)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedOrderModal(null)}
                  className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Scrollable Content */}
              <div className="p-6 overflow-y-auto space-y-6 flex-grow text-gray-900">
                {/* Client Info Card */}
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <User size={18} className="text-amber-800" />
                      <span className="font-serif font-bold text-base text-gray-900">
                        {selectedOrderModal.isB2B || selectedOrderModal.isPJ 
                          ? (selectedOrderModal.b2bCompanyName || selectedOrderModal.customerName) 
                          : selectedOrderModal.customerName}
                      </span>
                    </div>
                    {selectedOrderModal.phone && (
                      <a
                        href={`https://wa.me/${getCleanWhatsAppPhone(selectedOrderModal.phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 shadow-sm transition-all"
                      >
                        <MessageSquare size={13} />
                        <span>{formatBRPhone(selectedOrderModal.phone)}</span>
                      </a>
                    )}
                  </div>

                  {selectedOrderModal.email && (
                    <div className="text-xs text-gray-600 flex items-center gap-1.5">
                      <Mail size={14} className="text-gray-400" />
                      <span>{selectedOrderModal.email}</span>
                    </div>
                  )}

                  {/* Scheduled Delivery/Pickup Info */}
                  <div className="pt-3 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 bg-white rounded-xl border border-gray-200 space-y-1">
                      <span className="font-extrabold uppercase text-[10px] text-gray-500 flex items-center gap-1">
                        <Calendar size={12} className="text-blue-600" />
                        Data da Entrega / Retirada
                      </span>
                      <span className="font-bold text-sm text-gray-900 block">
                        {getOrderScheduledInfo(selectedOrderModal).dateDisplay || 'Não definida'}
                      </span>
                    </div>

                    <div className="p-2.5 bg-white rounded-xl border border-gray-200 space-y-1">
                      <span className="font-extrabold uppercase text-[10px] text-gray-500 flex items-center gap-1">
                        <Clock size={12} className="text-purple-600" />
                        Horário & Modalidade
                      </span>
                      <span className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                        {getOrderScheduledInfo(selectedOrderModal).isDelivery ? (
                          <>
                            <Truck size={14} className="text-blue-600" />
                            <span>Entrega ({getOrderScheduledInfo(selectedOrderModal).timeStr || '18:00'})</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag size={14} className="text-purple-600" />
                            <span>Retirada no Local ({getOrderScheduledInfo(selectedOrderModal).timeStr || '18:00'})</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Preferência de Pronta Entrega */}
                  {selectedOrderModal.wantsReadyDelivery && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 space-y-1 text-xs">
                      <span className="font-extrabold uppercase text-[10px] text-amber-800 flex items-center gap-1.5">
                        <Zap size={13} className="text-amber-600 fill-amber-500" />
                        Preferência: Pronta Entrega para Hoje (Sob Consulta)
                      </span>
                      <p className="font-medium text-amber-900 leading-snug">
                        O cliente solicitou pronta entrega hoje caso haja disponibilidade no estoque do dia. Confirme a disponibilidade e a taxa/rota pelo WhatsApp.
                      </p>
                    </div>
                  )}

                  {/* Delivery Address */}
                  {(selectedOrderModal.address || selectedOrderModal.b2bAddress) && (
                    <div className="p-2.5 bg-white rounded-xl border border-gray-200 space-y-1 text-xs">
                      <span className="font-extrabold uppercase text-[10px] text-gray-500 flex items-center gap-1">
                        <MapPin size={12} className="text-red-500" />
                        Endereço de Entrega
                      </span>
                      <p className="font-medium text-gray-800">
                        {selectedOrderModal.b2bAddress || selectedOrderModal.address}
                      </p>
                    </div>
                  )}

                  {selectedOrderModal.deliveryNeighborhood && (
                    <div className="p-2.5 bg-blue-50/80 rounded-xl border border-blue-200 flex items-center justify-between text-xs">
                      <span className="font-bold text-blue-900 flex items-center gap-1.5">
                        <MapPin size={14} className="text-blue-600" />
                        Bairro: {selectedOrderModal.deliveryNeighborhood}
                      </span>
                      <span className="font-extrabold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-md">
                        Taxa: {selectedOrderModal.deliveryFee ? `${currencySymbol} ${selectedOrderModal.deliveryFee.toFixed(2).replace('.', ',')}` : 'A combinar'}
                      </span>
                    </div>
                  )}

                  {/* Observations */}
                  {selectedOrderModal.observation && (
                    <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-200/80 space-y-1 text-xs">
                      <span className="font-extrabold uppercase text-[10px] text-amber-900 flex items-center gap-1">
                        <FileText size={12} className="text-amber-700" />
                        Observações do Cliente
                      </span>
                      <p className="italic text-gray-800">
                        {selectedOrderModal.observation}
                      </p>
                    </div>
                  )}
                </div>

                {/* Items List */}
                <div className="space-y-3">
                  <h4 className="font-serif font-bold text-sm text-gray-900 flex items-center gap-2">
                    <Package size={16} className="text-amber-800" />
                    Itens Solicitados
                  </h4>

                  <div className="space-y-2 border border-gray-200 rounded-2xl p-3 bg-white">
                    {selectedOrderModal.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start py-2 border-b border-gray-100 last:border-0 gap-3">
                        <div className="space-y-0.5">
                          <span className="font-bold text-sm text-gray-900">
                            {item.quantity}x {item.title}
                          </span>
                          {item.selectedSides && item.selectedSides.length > 0 && (
                            <p className="text-xs text-gray-500">
                              + {item.selectedSides.join(', ')}
                            </p>
                          )}
                          {item.comboOptions?.items && item.comboOptions.items.length > 0 && (
                            <div className="mt-1 p-2 bg-amber-50 rounded-lg border border-amber-200 text-xs">
                              <span className="font-bold text-amber-950 block text-[10px] uppercase">Sabores Escolhidos no Combo:</span>
                              <ul className="mt-0.5 space-y-0.5 text-gray-800">
                                {item.comboOptions.items.map((sub, sIdx) => (
                                  <li key={sIdx}>• {sub.quantity}x {sub.productTitle}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {item.notes && (
                            <p className="text-xs text-amber-800 italic">
                              Obs: {item.notes}
                            </p>
                          )}
                        </div>
                        <span className="font-extrabold text-sm text-gray-800 whitespace-nowrap">
                          {currencySymbol} {(item.price * item.quantity).toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    ))}

                    <div className="pt-3 border-t border-gray-200 space-y-1">
                      {selectedOrderModal.subtotal !== undefined && selectedOrderModal.deliveryNeighborhood && (
                        <div className="flex justify-between items-center text-xs text-gray-500 font-medium">
                          <span>Subtotal dos Itens:</span>
                          <span>{currencySymbol} {selectedOrderModal.subtotal.toFixed(2).replace('.', ',')}</span>
                        </div>
                      )}
                      {selectedOrderModal.deliveryNeighborhood && (
                        <div className="flex justify-between items-center text-xs text-blue-700 font-bold">
                          <span>Taxa de Entrega ({selectedOrderModal.deliveryNeighborhood}):</span>
                          <span>{selectedOrderModal.deliveryFee ? `+ ${currencySymbol} ${selectedOrderModal.deliveryFee.toFixed(2).replace('.', ',')}` : 'A combinar'}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                        <span className="font-serif font-bold text-sm text-gray-700">Total do Pedido:</span>
                        <span className="font-serif font-extrabold text-xl" style={{ color: settings?.primaryColor || '#865d39' }}>
                          {currencySymbol} {selectedOrderModal.total.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Delivery Status Quick Toggle */}
                  <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                    <span className="font-extrabold uppercase text-[10px] text-gray-500 block">
                      Status da Entrega
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          updateOrderDeliveryStatus(selectedOrderModal.id, 'pending');
                          setSelectedOrderModal({ ...selectedOrderModal, deliveryStatus: 'pending' });
                        }}
                        className={cn(
                          "flex-1 py-2 px-2 text-xs font-extrabold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1",
                          (!selectedOrderModal.deliveryStatus || selectedOrderModal.deliveryStatus === 'pending')
                            ? "bg-amber-100 text-amber-900 border-amber-400 shadow-sm ring-2 ring-amber-200"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                        )}
                      >
                        ⏳ A Entregar
                      </button>
                      <button
                        onClick={() => {
                          updateOrderDeliveryStatus(selectedOrderModal.id, 'delivered');
                          setSelectedOrderModal({ ...selectedOrderModal, deliveryStatus: 'delivered' });
                        }}
                        className={cn(
                          "flex-1 py-2 px-2 text-xs font-extrabold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1",
                          selectedOrderModal.deliveryStatus === 'delivered'
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-300"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                        )}
                      >
                        ✓ Entregue
                      </button>
                    </div>
                  </div>

                  {/* Payment Status Quick Toggle */}
                  <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                    <span className="font-extrabold uppercase text-[10px] text-gray-500 block">
                      Status do Pagamento
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => {
                          updateOrderPaymentStatus(selectedOrderModal.id, 'pending');
                          setSelectedOrderModal({ ...selectedOrderModal, paymentStatus: 'pending' });
                        }}
                        className={cn(
                          "flex-1 py-2 px-1 text-[11px] font-bold rounded-xl border transition-all cursor-pointer flex items-center justify-center text-center",
                          (!selectedOrderModal.paymentStatus || selectedOrderModal.paymentStatus === 'pending')
                            ? "bg-red-100 text-red-900 border-red-400 shadow-sm"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                        )}
                      >
                        ❌ Não Rec.
                      </button>
                      <button
                        onClick={() => {
                          updateOrderPaymentStatus(selectedOrderModal.id, 'half');
                          setSelectedOrderModal({ ...selectedOrderModal, paymentStatus: 'half' });
                        }}
                        className={cn(
                          "flex-1 py-2 px-1 text-[11px] font-bold rounded-xl border transition-all cursor-pointer flex items-center justify-center text-center",
                          selectedOrderModal.paymentStatus === 'half'
                            ? "bg-amber-100 text-amber-900 border-amber-400 shadow-sm ring-2 ring-amber-200"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                        )}
                      >
                        🪙 50%
                      </button>
                      <button
                        onClick={() => {
                          updateOrderPaymentStatus(selectedOrderModal.id, 'full');
                          setSelectedOrderModal({ ...selectedOrderModal, paymentStatus: 'full' });
                        }}
                        className={cn(
                          "flex-1 py-2 px-1 text-[11px] font-bold rounded-xl border transition-all cursor-pointer flex items-center justify-center text-center",
                          selectedOrderModal.paymentStatus === 'full'
                            ? "bg-green-600 text-white border-green-600 shadow-md ring-2 ring-green-300"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                        )}
                      >
                        ✅ Integral
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={() => printOrder(selectedOrderModal)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-xl text-gray-700 font-bold text-xs hover:bg-gray-100 shadow-sm transition-all cursor-pointer"
                >
                  <Printer size={16} />
                  <span>Imprimir Comanda</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const ord = selectedOrderModal;
                      setSelectedOrderModal(null);
                      setIsEditingOrder(ord);
                      setEditOrderForm({ ...ord, phone: formatBRPhone(ord.phone || '') });
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 shadow-sm transition-all cursor-pointer"
                  >
                    <Edit2 size={15} />
                    <span>Editar Pedido</span>
                  </button>
                  <button
                    onClick={() => setSelectedOrderModal(null)}
                    className="px-5 py-2 bg-gray-200 text-gray-800 rounded-xl font-bold text-xs hover:bg-gray-300 transition-all cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )}

      {activeTab === 'customers' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-3xl font-serif font-bold">Clientes</h2>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => {
                  setNewCustomerForm({
                    name: '', phone: '', email: '', birthday: '', isB2B: false, managerName: '', frequency: '', address: '', street: '', number: '', zipCode: '', city: ''
                  });
                  setIsRegisteringCustomer(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-white bg-green-600 hover:bg-green-700 shadow-md transition-all cursor-pointer"
              >
                <Plus size={18} /> Cadastrar Cliente
              </button>
              <button 
                onClick={() => {
                  setShowBirthdaysOnly(!showBirthdaysOnly);
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all cursor-pointer",
                  showBirthdaysOnly ? "bg-pink-500 text-white shadow-md" : "bg-white border border-gray-300 text-gray-600"
                )}
              >
                <Cake size={18} /> Aniversários da Semana
              </button>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-gray-200/90 shadow-sm">
            <div className="relative flex items-center">
              <Search size={18} className="absolute left-3.5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Buscar por nome, telefone, e-mail ou prato/item pedido..."
                className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none shadow-xs text-sm"
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
              />
              {customerSearch && (
                <button 
                  onClick={() => setCustomerSearch('')}
                  className="absolute right-3.5 p-1 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-all cursor-pointer"
                  title="Limpar busca"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {customerSearch.trim() && (
              <div className="mt-2 text-xs text-gray-500 font-medium flex items-center gap-1.5 pl-1">
                <span>🔍 Buscando por cliente ou pratos/itens pedidos nos históricos</span>
              </div>
            )}
          </div>

          {(() => {
            const normalizeSearchStr = (str?: string) =>
              (str || '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .trim();

            const cleanSearch = normalizeSearchStr(customerSearch);
            const cleanPhoneDigits = customerSearch.replace(/\D/g, '');

            const filteredCustomers = combinedCustomers
              .map(customer => {
                let matchedDishes: string[] = [];
                let isMatch = false;

                if (!cleanSearch) {
                  isMatch = true;
                } else {
                  const nameMatch = normalizeSearchStr(customer.name).includes(cleanSearch);
                  const emailMatch = normalizeSearchStr(customer.email).includes(cleanSearch);
                  const addressMatch = normalizeSearchStr(customer.address).includes(cleanSearch) ||
                    normalizeSearchStr(customer.street).includes(cleanSearch) ||
                    normalizeSearchStr(customer.city).includes(cleanSearch);
                  const phoneMatch = cleanPhoneDigits 
                    ? (customer.phone || '').replace(/\D/g, '').includes(cleanPhoneDigits)
                    : (customer.phone || '').includes(customerSearch);

                  if (nameMatch || emailMatch || addressMatch || phoneMatch) {
                    isMatch = true;
                  }

                  // Search inside customer's order history for dishes/items
                  if (customer.orders && Array.isArray(customer.orders)) {
                    customer.orders.forEach((ord: any) => {
                      if (ord.items && Array.isArray(ord.items)) {
                        ord.items.forEach((it: any) => {
                          if (it.title && normalizeSearchStr(it.title).includes(cleanSearch)) {
                            if (!matchedDishes.includes(it.title)) matchedDishes.push(it.title);
                            isMatch = true;
                          }
                          if (it.comboOptions?.items) {
                            it.comboOptions.items.forEach((sub: any) => {
                              if (sub.productTitle && normalizeSearchStr(sub.productTitle).includes(cleanSearch)) {
                                const comboTag = `${sub.productTitle} (${it.title})`;
                                if (!matchedDishes.includes(comboTag)) matchedDishes.push(comboTag);
                                isMatch = true;
                              }
                            });
                          }
                          if (it.cakeOptions?.fillings) {
                            it.cakeOptions.fillings.forEach((f: string) => {
                              if (normalizeSearchStr(f).includes(cleanSearch)) {
                                const fTag = `Recheio: ${f} (${it.title})`;
                                if (!matchedDishes.includes(fTag)) matchedDishes.push(fTag);
                                isMatch = true;
                              }
                            });
                          }
                          if (it.sandwichOptions?.fillings) {
                            it.sandwichOptions.fillings.forEach((f: string) => {
                              if (normalizeSearchStr(f).includes(cleanSearch)) {
                                const sTag = `Recheio: ${f} (${it.title})`;
                                if (!matchedDishes.includes(sTag)) matchedDishes.push(sTag);
                                isMatch = true;
                              }
                            });
                          }
                          if (it.mealOptions?.sides) {
                            it.mealOptions.sides.forEach((s: any) => {
                              if (normalizeSearchStr(s.name).includes(cleanSearch)) {
                                const sideTag = `Acompanhamento: ${s.name} (${it.title})`;
                                if (!matchedDishes.includes(sideTag)) matchedDishes.push(sideTag);
                                isMatch = true;
                              }
                            });
                          }
                        });
                      }
                    });
                  }
                }

                let matchesBirthday = true;
                if (showBirthdaysOnly) {
                  matchesBirthday = isBirthdayThisWeek(customer.birthday, customer.orderLanguage);
                }

                return {
                  customer,
                  isMatch: isMatch && matchesBirthday,
                  matchedDishes
                };
              })
              .filter(item => item.isMatch)
              .sort((a, b) => {
                const getTimestamp = (c: any) => {
                  if (c.lastOrder) {
                    if (c.lastOrder.toDate) return c.lastOrder.toDate().getTime();
                    if (c.lastOrder instanceof Date) return c.lastOrder.getTime();
                    const parsed = Date.parse(c.lastOrder);
                    if (!isNaN(parsed)) return parsed;
                  }
                  if (c.createdAt) {
                    if (c.createdAt.toDate) return c.createdAt.toDate().getTime();
                    if (c.createdAt instanceof Date) return c.createdAt.getTime();
                    const parsed = Date.parse(c.createdAt);
                    if (!isNaN(parsed)) return parsed;
                  }
                  return 0;
                };
                const timeA = getTimestamp(a.customer);
                const timeB = getTimestamp(b.customer);
                return timeB - timeA;
              });

            if (filteredCustomers.length === 0) {
              return (
                <div className="bg-white/95 backdrop-blur-md p-12 rounded-3xl border border-gray-200 text-center space-y-3 shadow-sm">
                  <div className="w-14 h-14 bg-amber-50 text-amber-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <Search size={26} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 font-serif">Nenhum cliente encontrado</h3>
                  <p className="text-sm text-gray-500 max-w-md mx-auto">
                    Não encontramos nenhum cliente ou pedido correspondente a <strong>"{customerSearch}"</strong>.
                  </p>
                  {customerSearch && (
                    <button 
                      onClick={() => setCustomerSearch('')}
                      className="mt-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-sm transition-all cursor-pointer"
                    >
                      Limpar Busca
                    </button>
                  )}
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCustomers.map(({ customer, matchedDishes }, idx) => {
                  const isBdayUpcoming = customer.birthday && isBirthdayThisWeek(customer.birthday, customer.orderLanguage);
                  return (
                    <motion.div 
                      key={customer.id || idx}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className={cn(
                        "p-6 rounded-3xl space-y-4 relative overflow-hidden group transition-all duration-300",
                        isBdayUpcoming 
                          ? "bg-gradient-to-br from-pink-50/95 to-amber-50/95 border-2 border-pink-300 shadow-[0_12px_30px_rgba(244,63,94,0.15)] scale-[1.01]" 
                          : "bg-white/95 backdrop-blur-md border border-gray-200/90 shadow-md hover:shadow-xl hover:border-gray-300 text-gray-900"
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1 flex-grow pr-3">
                          <div className="flex items-center gap-2">
                            <h3 
                              className="text-xl font-serif font-black"
                              style={{ color: settings?.primaryColor || '#865d39' }}
                            >
                              {customer.name}
                            </h3>
                          </div>
                          <a 
                            href={`https://wa.me/${getCleanWhatsAppPhone(customer.phone)}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-green-600 transition-colors font-medium"
                          >
                            <MessageCircle size={14} className="text-gray-400 group-hover:text-green-600" />
                            <span>{formatBRPhone(customer.phone)}</span>
                          </a>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button 
                            onClick={() => setViewingCustomerOrders(customer)}
                            className="px-2.5 py-1 rounded-full text-xs font-black whitespace-nowrap cursor-pointer transition-all border shadow-2xs hover:opacity-90"
                            style={{
                              backgroundColor: `${settings?.primaryColor || '#865d39'}15`,
                              borderColor: `${settings?.primaryColor || '#865d39'}30`,
                              color: settings?.primaryColor || '#865d39'
                            }}
                            title="Ver Histórico de Pedidos"
                          >
                            {customer.totalOrders} {customer.totalOrders === 1 ? 'Pedido' : 'Pedidos'}
                          </button>
                          <button 
                            onClick={() => {
                              setIsEditingCustomer(customer);
                              setEditCustomerForm({
                                name: customer.name,
                                phone: formatBRPhone(customer.phone),
                                email: customer.email,
                                birthday: customer.birthday,
                                address: customer.address,
                                isB2B: customer.isB2B,
                                managerName: customer.managerName,
                                street: customer.street,
                                number: customer.number,
                                zipCode: customer.zipCode,
                                city: customer.city,
                                frequency: customer.frequency
                              });
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 hover:text-blue-700 bg-white shadow-2xs border border-gray-200 rounded-xl flex items-center justify-center transition-all cursor-pointer"
                            title="Editar Cliente"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button 
                            onClick={() => {
                              setConfirmModal({
                                  isOpen: true,
                                  title: 'Excluir Cliente',
                                  message: `Tem certeza que deseja excluir o cliente ${customer.name} e todos os seus ${customer.totalOrders} pedidos?`,
                                  onConfirm: () => deleteCustomer(customer)
                              });
                            }}
                            className="p-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700 bg-white shadow-2xs border border-gray-200 rounded-xl flex items-center justify-center transition-all cursor-pointer"
                            title="Excluir Cliente"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {matchedDishes.length > 0 && customerSearch.trim() && (
                        <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-2.5 text-xs text-amber-900 flex items-start gap-2 shadow-2xs">
                          <Utensils size={14} className="text-amber-700 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <span className="font-bold text-amber-950 block">Prato/Item no Histórico:</span>
                            <div className="text-amber-900 font-medium">
                              {matchedDishes.slice(0, 2).map((d, i) => (
                                <span key={i} className="inline-block bg-amber-100/80 px-2 py-0.5 rounded-md text-[11px] font-semibold mr-1 mb-1">
                                  {d}
                                </span>
                              ))}
                              {matchedDishes.length > 2 && (
                                <span className="text-[10px] text-amber-700 font-bold">
                                  +{matchedDishes.length - 2} outros
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2 text-sm">
                        {customer.email && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <span className="font-bold text-gray-900">E-mail:</span>
                            <span className="text-gray-600 truncate">{customer.email}</span>
                          </div>
                        )}
                        {customer.birthday && (() => {
                          const isBdayUpcoming = isBirthdayThisWeek(customer.birthday, customer.orderLanguage);
                          return (
                            <div className="space-y-2">
                              {isBdayUpcoming ? (
                                <>
                                  <div className="flex items-center gap-2 text-pink-600 font-bold">
                                    <Cake size={14} />
                                    <span>Aniversário: {customer.birthday} (Esta semana! 🎉)</span>
                                  </div>
                                  <div className="flex flex-col gap-1.5 p-3 bg-pink-500/10 border border-pink-500/20 rounded-2xl mt-1.5">
                                    <span className="text-[10px] uppercase font-black text-pink-800 tracking-wider">
                                      🎁 Enviar Mensagem de Feliz Aniversário:
                                    </span>
                                    <div className="w-full">
                                      <a 
                                        href={`https://wa.me/${getCleanWhatsAppPhone(customer.phone)}?text=${encodeURIComponent(
                                          `Parabéns, ${customer.name}! 🎉 ${(settings?.birthdayMessageTemplate || 'A equipe da {empresa} te deseja um feliz aniversário! Que o seu dia seja repleto de realizações, saúde, sucesso e momentos doces. Como nosso presente para comemorar seu dia, preparamos uma oferta especial com surpresa no seu próximo pedido! 🎂🎁').replace(/\\{nome\\}/gi, customer.name).replace(/\\{empresa\\}/gi, settings?.brandName || 'nossa equipe')}`
                                        )}`}
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-1.5 w-full py-1.5 bg-green-650 hover:bg-green-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-sm border border-green-700/20"
                                      >
                                        <MessageCircle size={13} className="text-white" />
                                        <span>WhatsApp</span>
                                      </a>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="flex items-center gap-2 text-gray-700">
                                  <span className="font-bold text-gray-900">Aniversário:</span>
                                  <span className="text-gray-600">{customer.birthday}</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {customer.address && (
                          <div className="flex items-start gap-2 text-gray-700">
                            <span className="font-bold text-gray-900 shrink-0">Endereço:</span>
                            <span className="line-clamp-2 text-gray-600 font-medium">{customer.address}</span>
                          </div>
                        )}
                      </div>

                      <div className="pt-3.5 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500 font-medium">
                        <span>Último pedido:</span>
                        <span className="font-bold text-gray-700">
                          {customer.lastOrder?.toDate 
                            ? customer.lastOrder.toDate().toLocaleDateString('pt-BR') 
                            : customer.lastOrder instanceof Date
                              ? customer.lastOrder.toLocaleDateString('pt-BR')
                              : 'N/A'}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            );
          })()}
        </motion.div>
      )}
      
      <div className="mt-32 pt-16 pb-32 border-t border-gray-200/40 w-full">
        <Footer />
      </div>
      </main>

      <AnimatePresence>
        {isEditingCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-6 md:p-8 rounded-3xl w-full max-w-2xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto border border-gray-200 text-gray-900"
            >
              <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                <div>
                  <h3 className="text-2xl font-serif font-bold text-gray-900">Editar Cliente</h3>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">Atualize os dados de cadastro do cliente</p>
                </div>
                <button 
                  onClick={() => setIsEditingCustomer(null)} 
                  className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all cursor-pointer"
                >
                  <X size={22} />
                </button>
              </div>
              
              <form onSubmit={updateCustomer} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Nome do Cliente</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none shadow-xs text-sm"
                      value={editCustomerForm.name || ''}
                      onChange={e => setEditCustomerForm({...editCustomerForm, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">WhatsApp</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none shadow-xs text-sm"
                      value={formatBRPhone(editCustomerForm.phone || '')}
                      placeholder="(99) 99999-9999"
                      onChange={e => setEditCustomerForm({...editCustomerForm, phone: formatBRPhone(e.target.value)})}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">E-mail</label>
                    <input 
                      type="email" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none shadow-xs text-sm"
                      value={editCustomerForm.email || ''}
                      onChange={e => setEditCustomerForm({...editCustomerForm, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Aniversário (Dia/Mês)</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none shadow-xs text-sm"
                      value={editCustomerForm.birthday || ''}
                      placeholder="DD/MM"
                      onChange={e => {
                        let val = e.target.value.replace(/\D/g, '');
                        if (val.length > 4) val = val.slice(0, 4);
                        if (val.length > 2) {
                          val = val.slice(0, 2) + '/' + val.slice(2);
                        }
                        setEditCustomerForm({...editCustomerForm, birthday: val});
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Rua / Logradouro</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none shadow-xs text-sm"
                      value={editCustomerForm.street || ''}
                      onChange={e => setEditCustomerForm({...editCustomerForm, street: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Número</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none shadow-xs text-sm"
                      value={editCustomerForm.number || ''}
                      onChange={e => setEditCustomerForm({...editCustomerForm, number: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">CEP</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 font-mono font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none shadow-xs text-sm"
                      value={editCustomerForm.zipCode || ''}
                      onChange={e => setEditCustomerForm({...editCustomerForm, zipCode: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Cidade / Estado</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none shadow-xs text-sm"
                      value={editCustomerForm.city || ''}
                      onChange={e => setEditCustomerForm({...editCustomerForm, city: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Endereço Completo</label>
                  <input 
                    type="text" 
                    className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none shadow-xs text-sm"
                    value={editCustomerForm.address || ''}
                    onChange={e => setEditCustomerForm({...editCustomerForm, address: e.target.value})}
                  />
                </div>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all hover:opacity-95"
                  style={{ 
                    backgroundColor: settings?.primaryColor || '#865d39',
                    color: getContrastText(settings?.primaryColor || '#865d39')
                  }}
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : 'Salvar Alterações'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {isRegisteringCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-6 md:p-8 rounded-3xl w-full max-w-2xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto border border-gray-200 text-gray-900"
            >
              <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                <h3 className="text-2xl font-serif font-bold text-gray-900">Cadastrar Cliente</h3>
                <button onClick={() => setIsRegisteringCustomer(false)} className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all cursor-pointer">
                  <X size={22} />
                </button>
              </div>
              
              <form onSubmit={saveNewCustomer} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Nome do Cliente</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                      value={newCustomerForm.name || ''}
                      onChange={e => setNewCustomerForm({...newCustomerForm, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">WhatsApp / Telefone</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                      value={formatBRPhone(newCustomerForm.phone || '')}
                      placeholder="(99) 99999-9999"
                      onChange={e => setNewCustomerForm({...newCustomerForm, phone: formatBRPhone(e.target.value)})}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">E-mail</label>
                    <input 
                      type="email" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                      value={newCustomerForm.email || ''}
                      onChange={e => setNewCustomerForm({...newCustomerForm, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Aniversário (Dia/Mês)</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                      value={newCustomerForm.birthday || ''}
                      placeholder="DD/MM"
                      onChange={e => {
                        let val = e.target.value.replace(/\D/g, '');
                        if (val.length > 4) val = val.slice(0, 4);
                        if (val.length > 2) {
                          val = val.slice(0, 2) + '/' + val.slice(2);
                        }
                        setNewCustomerForm({...newCustomerForm, birthday: val});
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Rua / Logradouro</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                      value={newCustomerForm.street || ''}
                      onChange={e => setNewCustomerForm({...newCustomerForm, street: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Número</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                      value={newCustomerForm.number || ''}
                      onChange={e => setNewCustomerForm({...newCustomerForm, number: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">CEP</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 font-mono font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                      value={newCustomerForm.zipCode || ''}
                      onChange={e => setNewCustomerForm({...newCustomerForm, zipCode: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Cidade / Estado</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                      value={newCustomerForm.city || ''}
                      onChange={e => setNewCustomerForm({...newCustomerForm, city: e.target.value})}
                    />
                  </div>
                </div>
                 <button 
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all hover:opacity-95"
                  style={{ 
                    backgroundColor: settings?.primaryColor || '#865d39',
                    color: getContrastText(settings?.primaryColor || '#865d39')
                  }}
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : 'Cadastrar Cliente'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {isEditingOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-6 md:p-8 rounded-3xl w-full max-w-2xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto border border-gray-200 text-gray-900"
            >
              <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                <h3 className="text-2xl font-serif font-bold text-gray-900">Editar Pedido</h3>
                <button onClick={() => setIsEditingOrder(null)} className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all cursor-pointer">
                  <X size={22} />
                </button>
              </div>
              
              <form onSubmit={handleEditOrder} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Nome do Cliente</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                      value={editOrderForm.customerName || ''}
                      onChange={e => setEditOrderForm({...editOrderForm, customerName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">WhatsApp</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                      value={formatBRPhone(editOrderForm.phone || '')}
                      placeholder="(99) 99999-9999"
                      onChange={e => setEditOrderForm({...editOrderForm, phone: formatBRPhone(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Email</label>
                    <input 
                      type="email" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                      value={editOrderForm.email || ''}
                      onChange={e => setEditOrderForm({...editOrderForm, email: e.target.value})}
                    />
                  </div>
                   <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Aniversário (Dia/Mês)</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                      value={editOrderForm.birthday || ''}
                      placeholder="DD/MM"
                      onChange={e => {
                        let val = e.target.value.replace(/\D/g, '');
                        if (val.length > 4) val = val.slice(0, 4);
                        if (val.length > 2) {
                          val = val.slice(0, 2) + '/' + val.slice(2);
                        }
                        setEditOrderForm({...editOrderForm, birthday: val});
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Endereço</label>
                  <input 
                    type="text" 
                    className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                    value={editOrderForm.address || ''}
                    onChange={e => setEditOrderForm({...editOrderForm, address: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Data de Entrega (DD/MM/AAAA) (Opcional)</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                      value={editOrderForm.pickupDate || ''}
                      onChange={e => {
                        const masked = handleDateMask(e.target.value);
                        setEditOrderForm({...editOrderForm, pickupDate: masked});
                      }}
                      placeholder="DD/MM/AAAA"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Preço Final (Total)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-500">{currencySymbol}</span>
                      <input 
                        type="number" 
                        step="0.01" 
                        className="w-full p-3 pl-12 rounded-xl border border-gray-300 bg-white font-bold text-blue-700 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={editOrderForm.total || 0}
                        onChange={e => setEditOrderForm({...editOrderForm, total: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                </div>

                {/* --- SEÇÃO DE ITENS DO PEDIDO --- */}
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-gray-900">Itens do Pedido</h4>
                  
                  {editOrderForm.items && editOrderForm.items.length > 0 ? (
                    <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-2">
                      {editOrderForm.items.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-200 gap-3 text-gray-900 shadow-sm">
                          <div className="flex-grow">
                            <p className="font-bold text-sm text-gray-900">{item.title}</p>
                            {item.selectedSize && (
                              <p className="text-xs text-gray-600 font-semibold">Tamanho: {item.selectedSize.name}</p>
                            )}
                            {item.sandwichOptions && item.sandwichOptions.fillings && item.sandwichOptions.fillings.length > 0 && (
                              <div className="text-xs text-gray-600 space-y-0.5 mt-0.5">
                                <p>Recheios: {item.sandwichOptions.fillings.join(', ')}</p>
                              </div>
                            )}
                            {item.cakeOptions && (
                              <div className="text-xs text-gray-600 space-y-0.5 mt-0.5">
                                {item.cakeOptions.size && <p>Tamanho: {item.cakeOptions.size}</p>}
                                {item.cakeOptions.dough && <p>Massa: {item.cakeOptions.dough}</p>}
                                {item.cakeOptions.fillings && item.cakeOptions.fillings.length > 0 && (
                                  <p>Recheios: {item.cakeOptions.fillings.join(', ')}</p>
                                )}
                                {item.cakeOptions.topping && <p>Cobertura: {item.cakeOptions.topping}</p>}
                                {item.cakeOptions.topper && <p>Topper: {item.cakeOptions.topper}</p>}
                              </div>
                            )}
                            {item.mealOptions && (
                              <div className="text-xs text-gray-600 space-y-0.5 mt-0.5">
                                {item.mealOptions.removals && item.mealOptions.removals.length > 0 && (
                                  <p>Sem: {item.mealOptions.removals.join(', ')}</p>
                                )}
                                {item.mealOptions.sides && item.mealOptions.sides.length > 0 && (
                                  <p>Extras: {item.mealOptions.sides.map(s => s.name).join(', ')}</p>
                                )}
                              </div>
                            )}
                            
                            {/* Editable price input for high usability */}
                            <div className="flex items-center gap-1.5 mt-1.5 text-xs">
                              <span className="font-bold text-gray-700">Preço: {currencySymbol}</span>
                              <input 
                                type="number" 
                                step="0.01" 
                                className="w-24 px-2.5 py-1 rounded-lg border border-gray-300 bg-white text-gray-900 font-bold text-xs shadow-sm" 
                                value={item.price} 
                                onChange={e => {
                                  const newPrice = parseFloat(e.target.value) || 0;
                                  const updatedItems = [...(editOrderForm.items || [])];
                                  updatedItems[index].price = newPrice;
                                  updateOrderFormWithItems(updatedItems);
                                }} 
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden bg-white shadow-sm">
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedItems = [...(editOrderForm.items || [])];
                                  if (updatedItems[index].quantity > 1) {
                                    updatedItems[index].quantity -= 1;
                                    updateOrderFormWithItems(updatedItems);
                                  }
                                }}
                                className="px-2.5 py-1 hover:bg-gray-100 font-bold border-r border-gray-300 text-gray-900 cursor-pointer"
                              >
                                -
                              </button>
                              <span className="px-3 py-1 font-bold text-sm min-w-[24px] text-center text-gray-900">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedItems = [...(editOrderForm.items || [])];
                                  updatedItems[index].quantity += 1;
                                  updateOrderFormWithItems(updatedItems);
                                }}
                                className="px-2.5 py-1 hover:bg-gray-100 font-bold border-l border-gray-300 text-gray-900 cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const updatedItems = (editOrderForm.items || []).filter((_, idx) => idx !== index);
                                updateOrderFormWithItems(updatedItems);
                              }}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                              title="Excluir item"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm italic text-gray-500 bg-gray-50 p-3 rounded-xl border border-dashed border-gray-300 text-center">Nenhum item neste pedido.</p>
                  )}

                  {/* Add item interface */}
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-700">Adicionar Novo Item ao Pedido</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <select
                        value={selectedProductId}
                        onChange={e => setSelectedProductId(e.target.value)}
                        className="flex-grow p-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 font-medium shadow-sm focus:outline-none"
                      >
                        <option value="">-- Selecione um produto --</option>
                        {products.flatMap(p => {
                          if (p.hasSizes && p.sizes && p.sizes.length > 0) {
                            return p.sizes.map(s => (
                              <option key={`${p.id}::${s.id || s.name}`} value={`${p.id}::${s.id || s.name}`}>
                                {p.title} - {s.name} ({currencySymbol} {s.price.toFixed(2)})
                              </option>
                            ));
                          } else {
                            const activePrice = (p.price && p.price > 0) ? p.price : (p.oldPrice || 0);
                            return (
                              <option key={p.id} value={p.id}>
                                {p.title} ({currencySymbol} {activePrice.toFixed(2)})
                              </option>
                            );
                          }
                        })}
                      </select>
                      
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="1"
                          className="w-16 p-3 rounded-xl border border-gray-300 text-center font-bold text-gray-900 bg-white shadow-sm"
                          value={addItemQuantity}
                          onChange={e => setAddItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedProductId) return;
                            
                            let prodId = selectedProductId;
                            let sizeKey = '';
                            
                            if (selectedProductId.includes('::')) {
                              const parts = selectedProductId.split('::');
                              prodId = parts[0];
                              sizeKey = parts[1];
                            }
                            
                            const prod = products.find(p => p.id === prodId);
                            if (!prod) return;
                            
                            let activePrice = 0;
                            let itemTitle = prod.title;
                            let selectedSizeObj: any = undefined;
                            
                            if (sizeKey && prod.sizes) {
                              const foundSize = prod.sizes.find(s => (s.id === sizeKey || s.name === sizeKey));
                              if (foundSize) {
                                activePrice = foundSize.price;
                                selectedSizeObj = foundSize;
                              } else {
                                activePrice = (prod.price && prod.price > 0) ? prod.price : (prod.oldPrice || 0);
                              }
                            } else {
                              activePrice = (prod.price && prod.price > 0) ? prod.price : (prod.oldPrice || 0);
                            }
                            
                            const newItem = {
                              title: itemTitle,
                              quantity: addItemQuantity,
                              price: activePrice,
                              selectedSize: selectedSizeObj,
                              cakeOptions: {},
                              mealOptions: {
                                removals: [],
                                sides: []
                              }
                            };
                            
                            const updatedItems = [...(editOrderForm.items || []), newItem];
                            updateOrderFormWithItems(updatedItems);
                            
                            // Reset selection
                            setSelectedProductId('');
                            setAddItemQuantity(1);
                          }}
                          disabled={!selectedProductId}
                          className="px-4 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs sm:text-sm transition-all whitespace-nowrap uppercase tracking-wider cursor-pointer shadow-md"
                        >
                          Adicionar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Observações</label>
                  <textarea 
                    className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                    rows={3}
                    value={editOrderForm.observation || ''}
                    onChange={e => setEditOrderForm({...editOrderForm, observation: e.target.value})}
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 rounded-xl font-bold text-lg shadow-lg cursor-pointer transition-all hover:opacity-95"
                  style={{ 
                    backgroundColor: settings?.primaryColor || '#865d39',
                    color: getContrastText(settings?.primaryColor || '#865d39')
                  }}
                >
                  Salvar Alterações
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {isAddingOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-6 md:p-8 rounded-3xl w-full max-w-3xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto text-gray-900 border border-gray-200"
            >
              <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                <h3 className="text-2xl font-serif font-bold text-gray-900">Criar Pedido Manual</h3>
                <button 
                  onClick={() => setIsAddingOrder(false)} 
                  className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all cursor-pointer"
                >
                  <X size={22} />
                </button>
              </div>

              {/* Buscar Cliente Cadastrado (Opcional) */}
              <div className="space-y-2 relative">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Buscar Cliente Cadastrado (Opcional)</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    className="pl-10 w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800"
                    placeholder="Digite o nome, whatsapp ou e-mail do cliente..."
                    value={orderCustomerSearch}
                    onChange={e => setOrderCustomerSearch(e.target.value)}
                  />
                </div>
                {orderCustomerSearch.trim().length > 0 && (() => {
                  const filtered = combinedCustomers.filter(c => 
                    c.name.toLowerCase().includes(orderCustomerSearch.toLowerCase()) ||
                    c.phone.includes(orderCustomerSearch) ||
                    (c.email && c.email.toLowerCase().includes(orderCustomerSearch.toLowerCase()))
                  );
                  if (filtered.length === 0) return null;
                  return (
                    <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto mt-1 divide-y divide-gray-100">
                      {filtered.map((c, i) => (
                        <button
                          key={i}
                          type="button"
                          className="w-full text-left p-3 hover:bg-gray-50 flex flex-col cursor-pointer"
                          onClick={() => {
                            setManualOrderForm({
                              ...manualOrderForm,
                              customerName: c.name,
                              phone: c.phone || '',
                              email: c.email || '',
                              address: c.address || '',
                              street: c.street || c.address || '',
                              number: c.number || '',
                              zipCode: c.zipCode || '',
                              city: c.city || '',
                              birthday: c.birthday || '',
                              deliveryOption: 'delivery'
                            });
                            setOrderCustomerSearch('');
                          }}
                        >
                          <span className="font-bold text-sm text-gray-900">{c.name}</span>
                          <span className="text-xs text-gray-500 font-medium">{c.phone} {c.email ? `| ${c.email}` : ''}</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Form de Dados do Cliente e Pedido */}
              <form onSubmit={e => { e.preventDefault(); handleCreateManualOrder(); }} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Nome do Cliente</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Nome completo do cliente"
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800"
                      value={manualOrderForm.customerName || ''}
                      onChange={e => setManualOrderForm({...manualOrderForm, customerName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">WhatsApp</label>
                    <input 
                      type="text" 
                      required
                      placeholder="(99) 99999-9999"
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800"
                      value={formatBRPhone(manualOrderForm.phone || '')}
                      onChange={e => setManualOrderForm({...manualOrderForm, phone: formatBRPhone(e.target.value)})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">E-mail</label>
                    <input 
                      type="email" 
                      placeholder="email@exemplo.com"
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800"
                      value={manualOrderForm.email || ''}
                      onChange={e => setManualOrderForm({...manualOrderForm, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Aniversário (Dia/Mês)</label>
                    <input 
                      type="text" 
                      placeholder="DD/MM"
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800"
                      value={manualOrderForm.birthday || ''}
                      onChange={e => {
                        let val = e.target.value.replace(/\D/g, '');
                        if (val.length > 4) val = val.slice(0, 4);
                        if (val.length > 2) {
                          val = val.slice(0, 2) + '/' + val.slice(2);
                        }
                        setManualOrderForm({...manualOrderForm, birthday: val});
                      }}
                    />
                  </div>
                </div>

                {/* Escolha entre Entrega ou Retirada */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Tipo de Pedido / Modalidade</label>
                  <div className="grid grid-cols-2 gap-3 p-1.5 bg-gray-100 rounded-2xl border border-gray-200">
                    <button
                      type="button"
                      onClick={() => setManualOrderForm({ ...manualOrderForm, deliveryOption: 'delivery' })}
                      className={cn(
                        "py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center text-center transition-all cursor-pointer",
                        manualOrderForm.deliveryOption === 'delivery'
                          ? "bg-white text-gray-900 shadow-md ring-2 ring-amber-800/40 font-extrabold"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
                      )}
                    >
                      <span>Entrega em Domicílio</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualOrderForm({ ...manualOrderForm, deliveryOption: 'pickup' })}
                      className={cn(
                        "py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center text-center transition-all cursor-pointer",
                        manualOrderForm.deliveryOption === 'pickup'
                          ? "bg-white text-gray-900 shadow-md ring-2 ring-amber-800/40 font-extrabold"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
                      )}
                    >
                      <span>Retirada no Local</span>
                    </button>
                  </div>
                </div>

                {/* Bloco de Endereço (somente 1 bloco, exibido quando for Entrega) */}
                {manualOrderForm.deliveryOption === 'delivery' ? (
                  <div className="space-y-4 p-4 bg-amber-50/40 rounded-2xl border border-amber-200/70">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900">
                      <Truck size={16} className="text-amber-800" />
                      <span>Endereço de Entrega</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Rua / Logradouro</label>
                        <input 
                          type="text" 
                          placeholder="Ex: Rua Bertioga"
                          className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800"
                          value={manualOrderForm.street || ''}
                          onChange={e => setManualOrderForm({...manualOrderForm, street: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Número</label>
                        <input 
                          type="text" 
                          placeholder="Ex: 999"
                          className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800"
                          value={manualOrderForm.number || ''}
                          onChange={e => setManualOrderForm({...manualOrderForm, number: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-700">CEP</label>
                        <input 
                          type="text" 
                          placeholder="13467-570"
                          className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 font-mono font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800"
                          value={manualOrderForm.zipCode || ''}
                          onChange={e => setManualOrderForm({...manualOrderForm, zipCode: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Cidade / Estado</label>
                        <input 
                          type="text" 
                          placeholder="Campinas / SP"
                          className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800"
                          value={manualOrderForm.city || ''}
                          onChange={e => setManualOrderForm({...manualOrderForm, city: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-900 shadow-sm">
                    <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-800">
                      <ShoppingBag size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-900">Modalidade: Retirada no Local / Balcão</p>
                      <p className="text-xs text-emerald-700 mt-0.5">O cliente irá retirar o pedido presencialmente no estabelecimento.</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-700">
                    {manualOrderForm.deliveryOption === 'pickup' ? 'Data de Retirada (DD/MM/AAAA)' : 'Data de Entrega (DD/MM/AAAA)'}
                  </label>
                  <BRDatePicker 
                    placeholder="DD/MM/AAAA"
                    value={manualOrderForm.pickupDate || ''}
                    onChange={(val) => setManualOrderForm({ ...manualOrderForm, pickupDate: val })}
                  />
                </div>

                {/* Seção Adicionar Itens */}
                <div className="space-y-4 p-5 rounded-2xl bg-gray-50 border border-gray-200 shadow-sm">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-gray-900">Adicionar Itens ao Pedido</h4>
                  
                  <div className="space-y-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Selecione o Produto</label>
                    <select
                      value={selectedManualProduct ? selectedManualProduct.id : ''}
                      onChange={e => {
                        const prod = products.find(p => p.id === e.target.value);
                        setSelectedManualProduct(prod || null);
                        setSelectedManualSize(null);
                        setSelectedManualMealRemovals([]);
                        setSelectedManualMealSides([]);
                        setSelectedManualCakeOptions({
                          size: '',
                          dough: '',
                          fillings: [],
                          topping: '',
                          topper: '',
                          styleNumber: 1
                        });
                      }}
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 font-medium text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800"
                    >
                      <option value="">-- Selecione um produto --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>

                  {selectedManualProduct && (
                    <div className="space-y-4 p-4 rounded-xl bg-white border border-gray-200 shadow-sm">
                      <p className="font-bold text-sm text-gray-900">{selectedManualProduct.title}</p>

                      {/* Variantes/Tamanhos */}
                      {selectedManualProduct.hasSizes && selectedManualProduct.sizes && selectedManualProduct.sizes.length > 0 && (
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Escolha o Tamanho</label>
                          <select
                            value={selectedManualSize ? selectedManualSize.name : ''}
                            onChange={e => {
                              const sz = selectedManualProduct.sizes?.find(s => s.name === e.target.value);
                              setSelectedManualSize(sz || null);
                            }}
                            className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-gray-900 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                          >
                            <option value="">-- Escolha um tamanho --</option>
                            {selectedManualProduct.sizes.map((s, idx) => (
                              <option key={idx} value={s.name}>
                                {s.name} - {currencySymbol} {s.price.toFixed(2)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Marmita/Prato */}
                      {selectedManualProduct.isMeal && (
                        <div className="space-y-3">
                          {selectedManualProduct.ingredients && (
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Remover Ingredientes (Se desejar)</label>
                              <div className="flex flex-wrap gap-2">
                                {selectedManualProduct.ingredients.split(',').map(i => i.trim()).filter(Boolean).map((ing, idx) => {
                                  const isRemoved = selectedManualMealRemovals.includes(ing);
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => {
                                        if (isRemoved) {
                                          setSelectedManualMealRemovals(selectedManualMealRemovals.filter(r => r !== ing));
                                        } else {
                                          setSelectedManualMealRemovals([...selectedManualMealRemovals, ing]);
                                        }
                                      }}
                                      className={cn(
                                        "px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer shadow-sm",
                                        isRemoved 
                                          ? "bg-red-50 border-red-200 text-red-600 line-through" 
                                          : "bg-white border-gray-300 text-gray-800 hover:border-gray-400"
                                      )}
                                    >
                                      Sem {ing}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {sides.length > 0 && (
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Adicionar Acompanhamentos</label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {sides.map((sideOpt, idx) => {
                                  const isSelected = selectedManualMealSides.some(s => s.name === sideOpt.name);
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => {
                                        if (isSelected) {
                                          setSelectedManualMealSides(selectedManualMealSides.filter(s => s.name !== sideOpt.name));
                                        } else {
                                          setSelectedManualMealSides([...selectedManualMealSides, sideOpt]);
                                        }
                                      }}
                                      className={cn(
                                        "p-2.5 rounded-xl border transition-all flex items-center justify-between text-left text-xs font-bold cursor-pointer shadow-sm",
                                        isSelected 
                                          ? "border-amber-700 bg-amber-50 text-amber-900" 
                                          : "bg-white border-gray-300 hover:border-gray-400 text-gray-800"
                                      )}
                                    >
                                      <span>{sideOpt.name}</span>
                                      <span className="opacity-80 font-mono">+{currencySymbol} {sideOpt.price.toFixed(2)}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Custom Cake */}
                      {selectedManualProduct.isCustomCake && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Cake Size */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-700">Tamanho do Bolo</label>
                              <select
                                value={selectedManualCakeOptions.size || ''}
                                onChange={e => setSelectedManualCakeOptions({...selectedManualCakeOptions, size: e.target.value})}
                                className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-gray-900 text-xs font-medium shadow-sm focus:outline-none"
                              >
                                <option value="">-- Escolha o tamanho --</option>
                                {(settings.cakeSizes || []).map((sz, idx) => (
                                  <option key={idx} value={sz}>{sz}</option>
                                ))}
                              </select>
                            </div>

                            {/* Cake Dough */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-700">Massa do Bolo</label>
                              <select
                                value={selectedManualCakeOptions.dough || ''}
                                onChange={e => setSelectedManualCakeOptions({...selectedManualCakeOptions, dough: e.target.value})}
                                className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-gray-900 text-xs font-medium shadow-sm focus:outline-none"
                              >
                                <option value="">-- Escolha a massa --</option>
                                {(settings.cakeDoughs || []).map((dg, idx) => (
                                  <option key={idx} value={dg}>{dg}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Cake Fillings */}
                          {(settings.cakeFillings || []).length > 0 && (
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-gray-700">
                                <span>Opções de Recheio</span>
                                <span className="text-gray-500 font-semibold">Escolha até {settings.cakeFillingsMax || 2}</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {(settings.cakeFillings || []).map((fill, idx) => {
                                  const isSelected = (selectedManualCakeOptions.fillings || []).includes(fill);
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => {
                                        const current = selectedManualCakeOptions.fillings || [];
                                        if (isSelected) {
                                          setSelectedManualCakeOptions({
                                            ...selectedManualCakeOptions,
                                            fillings: current.filter((f: string) => f !== fill)
                                          });
                                        } else {
                                          const max = settings.cakeFillingsMax || 2;
                                          if (current.length >= max) {
                                            toast.error(`Você pode escolher no máximo ${max} recheios!`);
                                            return;
                                          }
                                          setSelectedManualCakeOptions({
                                            ...selectedManualCakeOptions,
                                            fillings: [...current, fill]
                                          });
                                        }
                                      }}
                                      className={cn(
                                        "p-2 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer shadow-sm",
                                        isSelected 
                                          ? "border-amber-700 bg-amber-50 text-amber-900 font-extrabold" 
                                          : "bg-white border-gray-300 hover:border-gray-400 text-gray-800"
                                      )}
                                    >
                                      {fill}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Cake Topping */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-700">Cobertura do Bolo</label>
                              <select
                                value={selectedManualCakeOptions.topping || ''}
                                onChange={e => setSelectedManualCakeOptions({...selectedManualCakeOptions, topping: e.target.value})}
                                className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-gray-900 text-xs font-medium shadow-sm focus:outline-none"
                              >
                                <option value="">-- Escolha a cobertura --</option>
                                {(settings.cakeToppings || []).map((tp, idx) => (
                                  <option key={idx} value={tp}>{tp}</option>
                                ))}
                              </select>
                            </div>

                            {/* Cake Topper */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-700">Texto do Topo de Bolo (Opcional)</label>
                              <input
                                type="text"
                                placeholder="Ex: Feliz Aniversário!"
                                className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-gray-900 text-xs font-medium shadow-sm focus:outline-none"
                                value={selectedManualCakeOptions.topper || ''}
                                onChange={e => setSelectedManualCakeOptions({...selectedManualCakeOptions, topper: e.target.value})}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Quantidade e Adicionar */}
                      <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden bg-white shadow-sm">
                          <button
                            type="button"
                            onClick={() => setManualProductQty(Math.max(1, manualProductQty - 1))}
                            className="px-3 py-2 hover:bg-gray-100 font-bold border-r border-gray-300 text-gray-900 text-sm cursor-pointer"
                          >
                            -
                          </button>
                          <span className="px-4 py-2 font-bold text-sm min-w-[32px] text-center text-gray-900">{manualProductQty}</span>
                          <button
                            type="button"
                            onClick={() => setManualProductQty(manualProductQty + 1)}
                            className="px-3 py-2 hover:bg-gray-100 font-bold border-l border-gray-300 text-gray-900 text-sm cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                        
                        <button
                          type="button"
                          onClick={handleAddManualItem}
                          className="flex-grow py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm transition-all uppercase tracking-wider shadow-md cursor-pointer"
                        >
                          Adicionar Item ao Pedido
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Lista de Itens no Pedido Manual */}
                  {manualOrderItems.length > 0 ? (
                    <div className="space-y-2 mt-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-700">Itens Adicionados ({manualOrderItems.length})</p>
                      <div className="space-y-2 max-h-[25vh] overflow-y-auto pr-1">
                        {manualOrderItems.map((item, idx) => (
                          <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl shadow-sm gap-3">
                            <div>
                              <p className="font-bold text-sm text-gray-900">{item.title}</p>
                              <p className="text-xs text-gray-600 font-semibold">
                                {item.quantity}x {currencySymbol} {item.price.toFixed(2)} | Subtotal: {currencySymbol} {(item.price * item.quantity).toFixed(2)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setManualOrderItems(manualOrderItems.filter(it => it.id !== item.id));
                              }}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                              title="Remover Item"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                        <span className="font-bold text-sm text-gray-700">Total do Pedido:</span>
                        <span className="font-black text-xl text-green-700 font-serif">
                          {currencySymbol} {manualOrderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-500 text-xs italic bg-white border border-dashed border-gray-300 rounded-xl">
                      Nenhum item adicionado a este pedido ainda.
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Observações Gerais</label>
                  <textarea 
                    className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800"
                    rows={3}
                    placeholder="Ex: Cliente vai retirar às 14h, embalar para presente..."
                    value={manualOrderForm.observation || ''}
                    onChange={e => setManualOrderForm({...manualOrderForm, observation: e.target.value})}
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all hover:opacity-95"
                  style={{ 
                    backgroundColor: settings?.primaryColor || '#865d39',
                    color: getContrastText(settings?.primaryColor || '#865d39')
                  }}
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : 'Confirmar e Criar Pedido'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {viewingCustomerOrders && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-6 md:p-8 rounded-3xl w-full max-w-3xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto border border-gray-200 text-gray-900"
            >
              <div className="flex justify-between items-start pb-4 border-b border-gray-100">
                <div className="space-y-1">
                  <span 
                    className="text-xs uppercase font-extrabold tracking-widest px-3 py-1 rounded-full inline-block"
                    style={{ 
                      backgroundColor: `${settings?.primaryColor || '#865d39'}15`, 
                      color: settings?.primaryColor || '#865d39' 
                    }}
                  >
                    Histórico do Cliente
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-serif font-black text-gray-900 mt-1">{viewingCustomerOrders.name}</h3>
                  <p className="text-sm text-gray-600 font-medium">
                    {formatBRPhone(viewingCustomerOrders.phone)} {viewingCustomerOrders.email ? `• ${viewingCustomerOrders.email}` : ''}
                  </p>
                </div>
                <button 
                  onClick={() => setViewingCustomerOrders(null)} 
                  className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all cursor-pointer"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500">
                  Pedidos Realizados ({viewingCustomerOrders.orders.length})
                </h4>
                
                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                  {viewingCustomerOrders.orders.map((order: Order, index: number) => (
                    <div 
                      key={order.id} 
                      className="p-5 bg-gray-50/90 border border-gray-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white hover:border-gray-300 transition-all shadow-xs"
                    >
                      <div className="space-y-2.5 flex-grow">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 bg-gray-200 text-gray-800 rounded">
                            #{order.id.slice(-6).toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500 font-medium">
                            {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString('pt-BR') : 'N/A'}
                          </span>
                          {order.pickupDate && (
                            <span 
                              className="text-[10px] font-black px-2.5 py-0.5 rounded-md text-white whitespace-nowrap"
                              style={{ backgroundColor: settings?.primaryColor || '#865d39' }}
                            >
                              🚚 Entrega: {order.pickupDate}
                            </span>
                          )}
                          {order.wantsReadyDelivery && (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap flex items-center gap-1">
                              <Zap size={10} className="text-amber-600 fill-amber-500" />
                              ⚡ Pronta Entrega
                            </span>
                          )}
                        </div>

                        <div className="space-y-1.5 text-sm">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="border-b border-gray-100 last:border-0 pb-1.5 last:pb-0">
                              <div className="flex justify-between font-semibold text-gray-900">
                                <span>{item.quantity}x {item.title}{item.selectedSize ? ` (${item.selectedSize.name})` : ''}</span>
                                <span className="text-gray-600 font-bold">{currencySymbol} {((item.price || 0) * item.quantity).toFixed(2).replace('.', ',')}</span>
                              </div>
                              {item.comboOptions?.items && item.comboOptions.items.length > 0 && (
                                <div className="text-xs text-gray-500 pl-2 border-l-2 border-amber-300 space-y-0.5 mt-1">
                                  {item.comboOptions.items.map((sub, sIdx) => (
                                    <div key={sIdx}>• {sub.quantity}x {sub.productTitle}</div>
                                  ))}
                                </div>
                              )}
                              {item.cakeOptions && (
                                <div className="text-xs text-gray-500 pl-2 border-l-2 border-amber-300 space-y-0.5 mt-1">
                                  {item.cakeOptions.size && <div><span className="font-bold">Tamanho:</span> {item.cakeOptions.size}</div>}
                                  {item.cakeOptions.dough && <div><span className="font-bold">Massa:</span> {item.cakeOptions.dough}</div>}
                                  {item.cakeOptions.fillings && item.cakeOptions.fillings.length > 0 && (
                                    <div><span className="font-bold">Recheios:</span> {item.cakeOptions.fillings.join(', ')}</div>
                                  )}
                                  {item.cakeOptions.topping && <div><span className="font-bold">Cobertura:</span> {item.cakeOptions.topping}</div>}
                                  {item.cakeOptions.topper && <div><span className="font-bold">Topper:</span> {item.cakeOptions.topper}</div>}
                                </div>
                              )}
                              {item.sandwichOptions && item.sandwichOptions.fillings && item.sandwichOptions.fillings.length > 0 && (
                                <div className="text-xs text-gray-500 pl-2 border-l-2 border-amber-300 mt-1">
                                  <span className="font-bold">Recheios:</span> {item.sandwichOptions.fillings.join(', ')}
                                </div>
                              )}
                              {item.mealOptions && (
                                <div className="text-xs text-gray-500 pl-2 border-l-2 border-amber-300 space-y-0.5 mt-1">
                                  {item.mealOptions.removals && item.mealOptions.removals.length > 0 && (
                                    <div><span className="font-bold">Remover:</span> {item.mealOptions.removals.join(', ')}</div>
                                  )}
                                  {item.mealOptions.sides && item.mealOptions.sides.length > 0 && (
                                    <div><span className="font-bold">Acompanhamentos:</span> {item.mealOptions.sides.map(s => s.name).join(', ')}</div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                          
                          {order.total > 0 && order.taxAmount && order.taxAmount > 0 && (
                            <div className="border-t border-gray-200 pt-2 space-y-1 text-xs text-gray-600 font-semibold">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Subtotal:</span>
                                <span>{currencySymbol} {(order.subtotal || (order.total - order.taxAmount)).toFixed(2).replace('.', ',')}</span>
                              </div>
                              <div className="flex justify-between text-amber-900">
                                <span className="text-gray-500">Imposto ({order.taxRate || 8.25}%):</span>
                                <span>+ {currencySymbol} {order.taxAmount.toFixed(2).replace('.', ',')}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {order.observation && order.observation.trim() !== '0' && order.observation.trim() !== '' && (
                          <p className="text-xs italic bg-amber-50 text-amber-900 p-2.5 rounded-xl border border-amber-200/80 font-medium">
                            <strong>Obs:</strong> {order.observation}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-row md:flex-col items-end justify-between md:justify-center gap-3 border-t md:border-t-0 border-gray-200 pt-3 md:pt-0">
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-gray-500 block">Valor Total</span>
                          <span className="text-lg font-black" style={{ color: settings?.primaryColor || '#865d39' }}>
                            {currencySymbol} {order.total.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => printOrder(order)}
                            className="p-2.5 bg-white border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 shadow-xs cursor-pointer transition-all"
                            title="Imprimir"
                          >
                            <Printer size={16} />
                          </button>
                          <button 
                            onClick={() => {
                              setIsEditingOrder(order);
                              setEditOrderForm({ ...order, phone: formatBRPhone(order.phone || '') });
                              setViewingCustomerOrders(null);
                            }}
                            className="p-2.5 bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-xl shadow-xs cursor-pointer transition-all"
                            title="Editar Pedido"
                          >
                            <Edit2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl text-center space-y-6 border border-gray-200 text-gray-900"
            >
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <Trash2 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-serif font-bold text-gray-900">{confirmModal.title}</h3>
                <p className="text-sm text-gray-600 font-medium">{confirmModal.message}</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 font-bold text-gray-800 cursor-pointer transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg cursor-pointer transition-all"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}

        <PrintReceiptModal 
          activePrintReceipt={activePrintReceipt} 
          onClose={() => setActivePrintReceipt(null)} 
        />
      </AnimatePresence>
    </div>
  );
}
