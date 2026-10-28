import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { 
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc 
} from 'firebase/firestore';
import { SupplyItem, Settings } from '../types';
import { 
  ShoppingBag, Plus, Trash2, Edit2, Search, ExternalLink, 
  X, Image as ImageIcon, Check, Loader2, Sparkles, AlertCircle, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface AdminSuppliesProps {
  settings: Settings;
}

// Helper to auto-repair known expired/broken image URLs from imgbb
export function repairSupplyImageUrl(url?: string, title?: string): string {
  if (!url) return '';
  const u = url.trim();
  
  // Known expired imgbb links mapped to working high quality images
  if (u.includes('nNN7g2m4') || (title && title.includes('Saco Delivery') && u.includes('saco-delivery'))) {
    return 'https://i.ibb.co/4nHF5BYD/100-Saco-Delivery-Kraft-Sos-Liso-15-Kg-A36-X-L12-X-C23-Cm-Gg.png';
  }
  if (u.includes('nNg3YQxM') || (title && title.includes('Pote Para Comida') && u.includes('pote.jpg'))) {
    return 'https://i.ibb.co/SDS8BsN4/Pote-Para-Comida-Congelada-500ml-144-Unid.png';
  }
  if (u.includes('qLCx059c') || (title && title.includes('Cinta de Papel'))) {
    return 'https://i.ibb.co/SDS8BsN4/Pote-Para-Comida-Congelada-500ml-144-Unid.png';
  }
  if (u.includes('tPpV20P1') || (title && title.includes('Bandeja Marmita Micro-ondas Freezer 500ml Prafesta'))) {
    return 'https://i.ibb.co/6JqJs6zV/Marmita-Embalagem-Microondas-Freezer-500ml-Prafesta-C24und-Cor-Transparente.png';
  }
  if (u.includes('Mknx833b') || (title && title.includes('Kit Bandejas Embalagem Refeição'))) {
    return 'https://i.ibb.co/8L7Rw501/Embalagem-Refei-o-Marmita-Fitness-50un-Mini-Cabe-850ml.png';
  }

  return u;
}

const DEFAULT_SUPPLIES: Omit<SupplyItem, 'id'>[] = [
  {
    title: 'Mini Etiqueta Impressora Bluetooth 58mm + 10 Rolos Cor Cinza-escuro',
    category: 'Utensílios',
    description: 'Mini impressora térmica portátil Bluetooth 58mm para etiquetas e comandas, com 10 rolos inclusos cor cinza-escuro.',
    imageUrl: 'https://i.ibb.co/Q7xhLZcc/Mini-Etiqueta-Impressora-Bluetooth-58mm-10-Rolos-Cor-Cinza-escuro.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/mini-etiqueta-impressora-bluetooth-58mm-10-rolos-cor-cinza-escuro/p/MLB44311255?matt_event_ts=1787684505196&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8&matt_tracing_id=450b2697-9f13-4365-b670-42079dd2ae4f#polycard_client=recommendations_home_affiliate-profile&reco_backend=item_decorator&reco_client=home_affiliate-profile&matt_tool_id=36377855&reco_item_pos=0&source=affiliate-profile&reco_backend_type=function&reco_id=6da36213-30e3-4ce0-ab60-591a8118aacf&tracking_id=15781',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Saco Delivery Kraft SOS Liso 15 Kg A36 X L12 X C23 Cm GG (100 un)',
    category: 'Embalagens',
    description: 'Saco delivery de papel kraft reforçado SOS liso capacidade 15kg (A36 x L12 x C23 cm) GG, pacote com 100 unidades.',
    imageUrl: 'https://i.ibb.co/4nHF5BYD/100-Saco-Delivery-Kraft-Sos-Liso-15-Kg-A36-X-L12-X-C23-Cm-Gg.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/100-saco-delivery-kraft-sos-liso-15-kg-a36-x-l12-x-c23-cm-gg/up/MLBU3362951144?pdp_filters=item_id%3AMLB4161681971&matt_tracing_id=07cf273d-9d41-4770-9ee5-04539ae0ec91&matt_event_ts=1787685025990&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8#polycard_client=recommendations_home_affiliate-profile&wid=MLB4161681971&sid=storefronts',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Pote Para Comida Congelada 500ml - 144 Unid',
    category: 'Embalagens',
    description: 'Pote transparente com tampa hermética para comida congelada e marmitas fit 500ml, caixa com 144 unidades.',
    imageUrl: 'https://i.ibb.co/SDS8BsN4/Pote-Para-Comida-Congelada-500ml-144-Unid.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/pote-para-comida-congelada-500ml-144-unid/p/MLB23195300?pdp_filters=item_id%3AMLB3359163799&matt_tracing_id=07cf273d-9d41-4770-9ee5-04539ae0ec91&matt_event_ts=1787685025990&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8#polycard_client=recommendations_home_affiliate-profile&wid=MLB3359163799&sid=storefronts',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Cinta de Papel Pote Marmita Fitness Congelada Personalizada (100 un)',
    category: 'Embalagens',
    description: '100 cintas de papel para potes e marmitas fitness congeladas personalizadas para lacrar e valorizar a embalagem.',
    imageUrl: 'https://i.ibb.co/SDS8BsN4/Pote-Para-Comida-Congelada-500ml-144-Unid.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/100-cinta-papel-pote-marmita-fitness-congelada-personalizada/up/MLBU3429383617?matt_event_ts=1787685025990&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8&matt_tracing_id=07cf273d-9d41-4770-9ee5-04539ae0ec91#polycard_client=recommendations_home_affiliate-profile',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Bandeja Marmita Micro-ondas Freezer 500ml Prafesta C/ 24und',
    category: 'Embalagens',
    description: 'Bandeja embalagem para micro-ondas e freezer 500ml Prafesta transparente com tampa hermética, pacote com 24 unidades.',
    imageUrl: 'https://i.ibb.co/6JqJs6zV/Marmita-Embalagem-Microondas-Freezer-500ml-Prafesta-C24und-Cor-Transparente.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/marmita-embalagem-microondas-freezer-500ml-prafesta-c24und-cor-transparente/p/MLB23193328?matt_event_ts=1787685025990&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8&matt_tracing_id=07cf273d-9d41-4770-9ee5-04539ae0ec91#polycard_client=recommendations_home_affiliate-profile&sid=storefronts&wid=MLB4637184741',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Kit Bandejas Embalagem Refeição Marmita Fitness 50un Mini Cabe 850ml',
    category: 'Embalagens',
    description: 'Embalagem para refeição marmita fitness com divisória 850ml, kit com 50 unidades com tampa hermética antivazamento.',
    imageUrl: 'https://i.ibb.co/8L7Rw501/Embalagem-Refei-o-Marmita-Fitness-50un-Mini-Cabe-850ml.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/embalagem-refeicao-marmita-fitness-50un-mini-cabe-850ml/up/MLBU1978191595?pdp_filters=item_id%3AMLB3723542833&matt_tracing_id=07cf273d-9d41-4770-9ee5-04539ae0ec91&matt_event_ts=1787685025990&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8#polycard_client=recommendations_home_affiliate-profile&wid=MLB3723542833&sid=storefronts',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Freezer Vertical Fricon Tripla Ação 569 Litros Vcet569 110v',
    category: 'Equipamentos',
    description: 'Freezer vertical tripla ação com capacidade de 569 litros, ideal para refrigeração, conservação e congelamento.',
    imageUrl: 'https://i.ibb.co/pjs11x9f/Freezer-Vertical-Fricon-Tripla-A-o-569-Litros-Vcet569-110v.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/freezer-vertical-fricon-tripla-acao-569-litros-vcet569-110v/up/MLBU3885857575?pdp_filters=item_id%3AMLB4594970523&matt_tracing_id=054b39d5-0f56-4052-8bab-804632c4a5cb&matt_event_ts=1787673442617&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Freezer Horizontal Consul 2 Portas 528 Litros Branco - CHB53MB',
    category: 'Equipamentos',
    description: 'Freezer horizontal 2 portas de 528 litros, espaçoso e com excelente controle de temperatura.',
    imageUrl: 'https://i.ibb.co/Xx8rRY3p/Freezer-Horizontal-Consul-2-Portas-528-Litros-Branco-CHB53-MB.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/freezer-horizontal-consul-2-portas-528-litros-branco-chb53mb/p/MLB65603793?pdp_filters=item_id%3AMLB6862185060&matt_event_ts=1787673442617&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8&matt_tracing_id=054b39d5-0f56-4052-8bab-804632c4a5cb',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Freezer Tripla Ação Vcet-569c Vertical 569 Litros Branco',
    category: 'Equipamentos',
    description: 'Freezer vertical tripla ação 569 litros branco, excelente durabilidade para alta demanda.',
    imageUrl: 'https://i.ibb.co/QjFDZ0pP/Freezer-Tripla-A-o-Vcet-569c-Vertical-569-Litros-Branco.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/freezer-tripla-acao-vcet-569c-vertical-569-litros-branco/p/MLB66334436?pdp_filters=item_id%3AMLB6428817606&matt_tracing_id=5109bd29-6148-405d-bb43-e85a2a674e17&matt_event_ts=1787674265994&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8#polycard_client=social-profile-middleend&wid=MLB6428817606&source=lists&type=product&tracking_id=c4bd2f15-03c7-4607-8b43-dfa5216de247&sid=storefronts',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Embalagem Refeição Marmita Fitness 50un Mini Cabe 850ml',
    category: 'Embalagens',
    description: 'Embalagem para refeição e marmitas fitness 850ml, kit com 50 unidades, ideal para freezer e micro-ondas.',
    imageUrl: 'https://i.ibb.co/8L7Rw501/Embalagem-Refei-o-Marmita-Fitness-50un-Mini-Cabe-850ml.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/embalagem-refeicao-marmita-fitness-50un-mini-cabe-850ml/up/MLBU1978191595?pdp_filters=item_id%3AMLB3723542833&matt_tracing_id=5109bd29-6148-405d-bb43-e85a2a674e17&matt_event_ts=1787674265994&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8#polycard_client=social-profile-middleend&wid=MLB3723542833&source=lists&type=item&tracking_id=c4bd2f15-03c7-4607-8b43-dfa5216de247&sid=storefronts',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Marmita Box Biodegradável Antivazamento Kit 480ml850ml 100u',
    category: 'Embalagens',
    description: 'Marmita box biodegradável com sistema antivazamento, kit 480ml e 850ml com 100 unidades.',
    imageUrl: 'https://i.ibb.co/pjmyVSfZ/Marmita-Box-Biodegrad-vel-Antivazamento-Kit-480ml850ml-100u.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/marmita-box-biodegradavel-antivazamento-kit-480ml850ml-100u/up/MLBU1970569138?pdp_filters=item_id%3AMLB2631261853&matt_tracing_id=5109bd29-6148-405d-bb43-e85a2a674e17&matt_event_ts=1787674265994&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8#polycard_client=social-profile-middleend&wid=MLB2631261853&source=lists&type=item&tracking_id=c4bd2f15-03c7-4607-8b43-dfa5216de247&sid=storefronts',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Kit C/ 2 Cadernos Livro Caixa Capa Dura 100 Folhas Cada',
    category: 'Outros',
    description: 'Kit com 2 cadernos livro caixa com capa dura e 100 folhas cada para controle e gestão financeira.',
    imageUrl: 'https://i.ibb.co/v7R0zMV/Kit-C-2-Cadernos-Livro-Caixa-Capa-Dura-100-Folhas-Cada.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/kit-c-2-cadernos-livro-caixa-capa-dura-100-folhas-cada/up/MLBU2805252909?matt_event_ts=1787674265994&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8&matt_tracing_id=5109bd29-6148-405d-bb43-e85a2a674e17',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Copo De Papel 80ml Com Tampa 200 Und',
    category: 'Embalagens',
    description: 'Copo de papel 80ml com tampa, pacote com 200 unidades, ideal para molhos, caldos e porções.',
    imageUrl: 'https://i.ibb.co/XxvrRnxH/Copo-De-Papel-80ml-Com-Tampa-200-Und.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/copo-de-papel--80ml-com-tampa-200-und/up/MLBU1726338787?matt_event_ts=1787674265994&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8&matt_tracing_id=5109bd29-6148-405d-bb43-e85a2a674e17',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Pote Para Comida Congelada 500ml - 144 Unid',
    category: 'Embalagens',
    description: 'Pote para comida congelada 500ml com tampa hermética inclusa, caixa com 144 unidades.',
    imageUrl: 'https://i.ibb.co/SDS8BsN4/Pote-Para-Comida-Congelada-500ml-144-Unid.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/pote-para-comida-congelada-500ml-144-unid/p/MLB23195300?pdp_filters=item_id%3AMLB3359163799&matt_tracing_id=5109bd29-6148-405d-bb43-e85a2a674e17&matt_event_ts=1787674265994&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8#polycard_client=social-profile-middleend&wid=MLB3359163799&source=lists&type=product&tracking_id=c4bd2f15-03c7-4607-8b43-dfa5216de247&sid=storefronts',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Marmita Embalagem Microondas Freezer 500ml Prafesta C/24und Cor Transparente',
    category: 'Embalagens',
    description: 'Marmita embalagem para micro-ondas e freezer 500ml Prafesta com 24 unidades cor transparente.',
    imageUrl: 'https://i.ibb.co/6JqJs6zV/Marmita-Embalagem-Microondas-Freezer-500ml-Prafesta-C24und-Cor-Transparente.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/marmita-embalagem-microondas-freezer-500ml-prafesta-c24und-cor-transparente/p/MLB23193328?matt_event_ts=1787674265994&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8&matt_tracing_id=5109bd29-6148-405d-bb43-e85a2a674e17#polycard_client=social-profile-middleend&source=lists&type=product&tracking_id=c4bd2f15-03c7-4607-8b43-dfa5216de247&wid=MLB4637184741&sid=storefronts',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Balança Digital 10kg Alta Precisão Cozinha Plástico Branca',
    category: 'Utensílios',
    description: 'Balança digital para cozinha com alta precisão e capacidade de até 10kg.',
    imageUrl: 'https://i.ibb.co/HDtGjx9v/Balan-a-Digital-10kg-Alta-Precis-o-Cozinha-Pl-stico-Branca.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/balanca-digital-10kg-alta-precisao-cozinha-plastico-branca/p/MLB36599511?matt_event_ts=1787674265994&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8&matt_tracing_id=5109bd29-6148-405d-bb43-e85a2a674e17#polycard_client=social-profile-middleend&source=lists&type=product&tracking_id=c4bd2f15-03c7-4607-8b43-dfa5216de247&wid=MLB6717497772&sid=storefronts',
    createdAt: new Date().toISOString()
  },
  {
    title: '100 Saco Delivery Kraft Sos Liso 15 Kg A36 X L12 X C23 Cm Gg',
    category: 'Embalagens',
    description: 'Saco delivery kraft SOS liso capacidade 15kg (A36 x L12 x C23 cm) tamanho GG, pacote com 100 unidades.',
    imageUrl: 'https://i.ibb.co/4nHF5BYD/100-Saco-Delivery-Kraft-Sos-Liso-15-Kg-A36-X-L12-X-C23-Cm-Gg.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/100-saco-delivery-kraft-sos-liso-15-kg-a36-x-l12-x-c23-cm-gg/up/MLBU3362951144?pdp_filters=item_id%3AMLB4161681971&matt_tracing_id=5109bd29-6148-405d-bb43-e85a2a674e17&matt_event_ts=1787674265994&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8#polycard_client=social-profile-middleend&wid=MLB4161681971&source=lists&type=item&tracking_id=c4bd2f15-03c7-4607-8b43-dfa5216de247&sid=storefronts',
    createdAt: new Date().toISOString()
  },
  {
    title: '5 Rolo Etiqueta P/ Impressora Xd210 Pt260 50x30 Prova D\'agua',
    category: 'Utensílios',
    description: '5 rolos de etiquetas adesivas térmicas para impressora XD210/PT260 (50x30mm) à prova d’água.',
    imageUrl: 'https://i.ibb.co/MyYW97NM/5-Rolo-Etiqueta-P-Impressora-Xd210-Pt260-50x30-Prova-D-agua.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/5-rolo-etiqueta-p-impressora-xd210-pt260-50x30-prova-dagua/up/MLBU1481916356?pdp_filters=item_id%3AMLB5068566944&matt_tracing_id=5109bd29-6148-405d-bb43-e85a2a674e17&matt_event_ts=1787674265994&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8#polycard_client=social-profile-middleend&wid=MLB5068566944&source=lists&type=item&tracking_id=c4bd2f15-03c7-4607-8b43-dfa5216de247&sid=storefronts',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Pote Para Comida Congelada 500ml - 144 Unid (Opção 2)',
    category: 'Embalagens',
    description: 'Potes transparentes de 500ml para marmitas e alimentos congelados com alta vedação, pacote com 144 unidades.',
    imageUrl: 'https://i.ibb.co/k2JRh3t6/Pote-Para-Comida-Congelada-500ml-144-Unid-2.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/pote-para-comida-congelada-500ml-144-unid/p/MLB23195300?pdp_filters=item_id%3AMLB3359163799&matt_tracing_id=5109bd29-6148-405d-bb43-e85a2a674e17&matt_event_ts=1787674265994&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8#polycard_client=social-profile-middleend&wid=MLB3359163799&source=lists&type=product&tracking_id=c4bd2f15-03c7-4607-8b43-dfa5216de247&sid=storefronts',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Jogo 3 Frigideiras Turim Listrada Com Tampa',
    category: 'Utensílios',
    description: 'Jogo de 3 frigideiras Turim listradas de alumínio com revestimento antiaderente Starflon e tampa.',
    imageUrl: 'https://i.ibb.co/R4GjN1cw/Jogo-3-Frigideiras-Turim-Listrada-Com-Tampa.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/jogo-3-frigideiras-turim-listrada-com-tampa/p/MLB39866623?matt_event_ts=1787680148224&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8&matt_tracing_id=1e10ce49-54b2-40d6-858a-b5affb298b94#polycard_client=social-profile-middleend&source=lists&type=product&tracking_id=fc8ae03e-0a09-49ba-9088-62ac67cfe96c&wid=MLB4828831535&sid=storefronts',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Pote Papel Branco Com Tampa Biodegradável 80ml - 100 Uni',
    category: 'Embalagens',
    description: 'Pote de papel branco biodegradável 80ml com tampa inclusa, pacote com 100 unidades.',
    imageUrl: 'https://i.ibb.co/5XJb7X3R/Pote-Papel-Branco-Com-Tampa-Biodegrad-vel-80ml-100-Uni.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/pote-papel-branco-com-tampa-biodegradavel-80ml--100-uni/up/MLBU761991868?pdp_filters=item_id%3AMLB3320091315&matt_tracing_id=1e10ce49-54b2-40d6-858a-b5affb298b94&matt_event_ts=1787680148224&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8#polycard_client=social-profile-middleend&wid=MLB3320091315&source=lists&type=item&tracking_id=fc8ae03e-0a09-49ba-9088-62ac67cfe96c&sid=storefronts',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Panela de Pressão Elétrica Electrolux 5L Cor Inox Efficient por Rita Lobo PCE20',
    category: 'Equipamentos',
    description: 'Panela de pressão elétrica Electrolux 5 litros em inox linha Efficient por Rita Lobo PCE20 com múltiplos programas.',
    imageUrl: 'https://i.ibb.co/W4Sgdr65/Panela-de-Press-o-El-trica-Electrolux-5-L-Cor-Inox-Efficient-por-Rita-Lobo-PCE20.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/panela-de-pressao-eletrica-electrolux-5l-cor-inox-efficient-por-rita-lobo-pce20/p/MLB16051358?pdp_filters=item_id%3AMLB1926198433&matt_tracing_id=1e10ce49-54b2-40d6-858a-b5affb298b94&matt_event_ts=1787680148224&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8#polycard_client=social-profile-middleend&wid=MLB1926198433&source=lists&type=product&tracking_id=fc8ae03e-0a09-49ba-9088-62ac67cfe96c&sid=storefronts',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Fritadeira a Gás 5L Fryer Chef Inox para Cozinha Doméstica',
    category: 'Equipamentos',
    description: 'Fritadeira a gás 5 litros Fryer Chef em aço inox de alta performance para frituras uniformes.',
    imageUrl: 'https://i.ibb.co/gbVxvdhR/Fritadeira-a-G-s-5-L-Fryer-Chef-Inox-para-Cozinha-Dom-stica.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/fritadeira-a-gas-5l-fryer-chef-inox-para-cozinha-domestica/p/MLB23946010?pdp_filters=item_id%3AMLB6624158826&matt_event_ts=1787680148224&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8&matt_tracing_id=1e10ce49-54b2-40d6-858a-b5affb298b94#polycard_client=social-profile-middleend&source=lists&type=product&tracking_id=fc8ae03e-0a09-49ba-9088-62ac67cfe96c&wid=MLB5997126110&sid=storefronts',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Fritadeira Air Fryer Forno Oven 12L, Mondial, 2000W - AFON-12L-BI',
    category: 'Equipamentos',
    description: 'Fritadeira sem óleo Air Fryer forno oven 12L Mondial 2000W com painel digital e cesto antiaderente.',
    imageUrl: 'https://i.ibb.co/0j4trNWf/Fritadeira-Air-Fryer-Forno-Oven-12-L-Mondial-2000-W-AFON-12-L-BI.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/fritadeira-air-fryer-forno-oven-12l-mondial-2000w-afon-12l-bi/p/MLB35830249?pdp_filters=item_id%3AMLB5477344432&matt_tracing_id=1e10ce49-54b2-40d6-858a-b5affb298b94&matt_event_ts=1787680148224&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8#polycard_client=social-profile-middleend&wid=MLB5477344432&source=lists&type=product&tracking_id=fc8ae03e-0a09-49ba-9088-62ac67cfe96c&sid=storefronts',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Jogo Panela Caçarola Grande Cozinha Industrial Aluminio N32 + N34 + N36',
    category: 'Utensílios',
    description: 'Jogo de caçarolas grandes industriais em alumínio grosso N32, N34 e N36 com alças reforçadas e tampas.',
    imageUrl: 'https://i.ibb.co/Z6hHzZps/Jogo-Panela-Ca-arola-Grande-Cozinha-Industrial-Aluminio-N32-N34-N36.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/jogo-panela-cacarola-grande-cozinha-industrial-aluminio-n32-n34-n36/p/MLB50133780?pdp_filters=item_id%3AMLB5392481198&matt_tracing_id=1e10ce49-54b2-40d6-858a-b5affb298b94&matt_event_ts=1787680148224&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8#polycard_client=social-profile-middleend&wid=MLB5392481198&source=lists&type=product&tracking_id=fc8ae03e-0a09-49ba-9088-62ac67cfe96c&sid=storefronts',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Kit 3 Caçarolas Alumínio Grande Industrial Restaurante Hotel',
    category: 'Utensílios',
    description: 'Kit de 3 caçarolas de alumínio grande industrial profissional para restaurantes, buffets e hotéis.',
    imageUrl: 'https://i.ibb.co/hJ8MGQTM/Kit-3-Ca-arolas-Alum-nio-Grande-Industrial-Restaurante-Hotel.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/kit-3-cacarolas-aluminio-grande-industrial-restaurante-hotel/up/MLBU3032437318?pdp_filters=item_id%3AMLB5295806760&matt_tracing_id=1e10ce49-54b2-40d6-858a-b5affb298b94&matt_event_ts=1787680148224&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8#polycard_client=social-profile-middleend&wid=MLB5295806760&source=lists&type=item&tracking_id=fc8ae03e-0a09-49ba-9088-62ac67cfe96c&sid=storefronts',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Fogão Industrial A Gás 3 Bocas Potente Alta Pressão Profissional Preto',
    category: 'Equipamentos',
    description: 'Fogão industrial a gás 3 bocas com queimadores potentes de alta pressão e estrutura em aço reforçado.',
    imageUrl: 'https://i.ibb.co/PGDNNH12/Fog-o-Industrial-A-G-s-3-Bocas-Potente-Alta-Press-o-Profissional-Preto.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/fogao-industrial-a-gas-3-bocas-potente-alta-pressao-profissional-preto/p/MLB55888982?pdp_filters=item_id%3AMLB4205491489&matt_tracing_id=1e10ce49-54b2-40d6-858a-b5affb298b94&matt_event_ts=1787680148224&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8#polycard_client=social-profile-middleend&wid=MLB4205491489&source=lists&type=product&tracking_id=fc8ae03e-0a09-49ba-9088-62ac67cfe96c&sid=storefronts',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Fogão Industrial Inox 6 Bocas Alta Pressão + Brinde',
    category: 'Equipamentos',
    description: 'Fogão industrial em aço inoxidável 6 bocas de alta pressão com trempes reforçadas para alta produtividade.',
    imageUrl: 'https://i.ibb.co/5hKV7jvb/Fog-o-Industrial-Inox-6-Bocas-Alta-Press-o-Brinde.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/fogao-industrial-inox-6-bocas-alta-pressao--brinde/up/MLBU1452019777?pdp_filters=item_id%3AMLB3603272607&matt_tracing_id=1e10ce49-54b2-40d6-858a-b5affb298b94&matt_event_ts=1787680148224&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8#polycard_client=social-profile-middleend&wid=MLB3603272607&source=lists&type=item&tracking_id=fc8ae03e-0a09-49ba-9088-62ac67cfe96c&sid=storefronts',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Fogão Industrial 4 Bocas Com Forno Melhor Preço Imperdivel !',
    category: 'Equipamentos',
    description: 'Fogão industrial 4 bocas completo acoplado com forno integrado para assados e preparos simultâneos.',
    imageUrl: 'https://i.ibb.co/5W9fMwNg/Fog-o-Industrial-4-Bocas-Com-Forno-Melhor-Pre-o-Imperdivel.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/fogao-industrial-4-bocas-com-forno-melhor-preco-imperdivel-/up/MLBU2465379113?pdp_filters=item_id%3AMLB5133464924&matt_tracing_id=1e10ce49-54b2-40d6-858a-b5affb298b94&matt_event_ts=1787680148224&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8#polycard_client=social-profile-middleend&wid=MLB5133464924&source=lists&type=item&tracking_id=fc8ae03e-0a09-49ba-9088-62ac67cfe96c&sid=storefronts',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Mixer industrial Robot Coupe Mini MP 240 V.V Cinza 290W',
    category: 'Equipamentos',
    description: 'Mixer de imersão industrial Robot Coupe Mini MP 240 V.V 290W profissional para purês, molhos e emulsões.',
    imageUrl: 'https://i.ibb.co/v4KH7DhV/Mixer-industrial-Robot-Coupe-Mini-MP-240-V-V-Cinza-290-W.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/mixer-industrial-robot-coupe-mini-mp-240-vv-cinza-290w/p/MLB19628259?pdp_filters=item_id%3AMLB3059037442&matt_tracing_id=1e10ce49-54b2-40d6-858a-b5affb298b94&matt_event_ts=1787680148224&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8#polycard_client=social-profile-middleend&wid=MLB3059037442&source=lists&type=product&tracking_id=fc8ae03e-0a09-49ba-9088-62ac67cfe96c&sid=storefronts',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Mixer Oster Power Omix370 750w',
    category: 'Equipamentos',
    description: 'Mixer Oster Power Omix370 potente de 750W com haste de inox e lâminas de alta durabilidade.',
    imageUrl: 'https://i.ibb.co/JjfsjhT0/Mixer-Oster-Power-Omix370-750w.png',
    purchaseUrl: 'https://produto.mercadolivre.com.br/MLB-4208139791-mixer-oster-power-omix370-750w-_JM?searchVariation=185474143910&matt_tracing_id=1e10ce49-54b2-40d6-858a-b5affb298b94&matt_event_ts=1787680148224&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8#polycard_client=social-profile-middleend&source=lists&type=item&tracking_id=fc8ae03e-0a09-49ba-9088-62ac67cfe96c',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Picador E Cortador Profissional De Legumes Com Qualidade',
    category: 'Utensílios',
    description: 'Picador e cortador profissional de legumes e batatas em alumínio fundido com navalha de precisão.',
    imageUrl: 'https://i.ibb.co/QjkcSrYn/Picador-E-Cortador-Profissional-De-Legumes-Com-Qualidade.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/picador-e-cortador-profissional-de-legumes-com-qualidade/p/MLB27364051?pdp_filters=item_id%3AMLB5878925426&matt_tracing_id=1e10ce49-54b2-40d6-858a-b5affb298b94&matt_event_ts=1787680148224&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8#polycard_client=social-profile-middleend&wid=MLB5878925426&source=lists&type=product&tracking_id=fc8ae03e-0a09-49ba-9088-62ac67cfe96c&sid=storefronts',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Kit Facas Plenus Lâminas Aço Inox 10 Peças Preto Tramontina',
    category: 'Utensílios',
    description: 'Kit de facas Tramontina Plenus com 10 peças, lâminas em aço inox e cabos de polipropileno preto.',
    imageUrl: 'https://i.ibb.co/PsZyTMvw/Kit-Facas-Plenus-L-minas-A-o-Inox-10-Pe-as-Preto-Tramontina.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/kit-facas-plenus-laminas-aco-inox-10-pecas-preto-tramontina/p/MLB27404680?pdp_filters=item_id%3AMLB4099961350&matt_tracing_id=1e10ce49-54b2-40d6-858a-b5affb298b94&matt_event_ts=1787680148224&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8#polycard_client=social-profile-middleend&wid=MLB4099961350&source=lists&type=product&tracking_id=fc8ae03e-0a09-49ba-9088-62ac67cfe96c&sid=storefronts',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Lacre Adesivo Segurança para Delivery JOTAPACK Pizzas Hambúrgueres 2000 Unidades',
    category: 'Embalagens',
    description: 'Lacre adesivo de segurança inviolável para caixas de delivery, pacotes e marmitas JOTAPACK com 2000 unidades.',
    imageUrl: 'https://i.ibb.co/93txdQkf/Lacre-Adesivo-Seguran-a-para-Delivery-JOTAPACK-Pizzas-Hamb-rgueres-2000-Unidades.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/lacre-adesivo-seguranca-para-delivery-jotapack-pizzas-hamburgueres-2000-unidades/p/MLB62734983?pdp_filters=item_id%3AMLB4340510087&matt_tracing_id=1e10ce49-54b2-40d6-858a-b5affb298b94&matt_event_ts=1787680148224&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8#polycard_client=social-profile-middleend&wid=MLB4340510087&source=lists&type=product&tracking_id=fc8ae03e-0a09-49ba-9088-62ac67cfe96c&sid=storefronts',
    createdAt: new Date().toISOString()
  },
  {
    title: '125 Etiqueta Marmita Fit Congelada Data Ingredientes 5x3,5cm',
    category: 'Utensílios',
    description: '125 etiquetas adesivas para marmitas fit congeladas com campos para data de fabricação, validade e ingredientes (5x3,5cm).',
    imageUrl: 'https://i.ibb.co/VcKnmQpV/125-Etiqueta-Marmita-Fit-Congelada-Data-Ingredientes-5x3-5cm.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/125-etiqueta-marmita-fit-congelada-data-ingredientes-5x35cm/up/MLBU3633247087?pdp_filters=item_id%3AMLB4333747447&matt_tracing_id=a8123af6-a59f-455e-bd38-d6dfb4966ed2&matt_event_ts=1787681412780&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8#polycard_client=social-profile-middleend&wid=MLB4333747447&source=lists&type=item&tracking_id=f7a159d8-0718-42fd-8438-10bc6fec68b6&sid=storefronts',
    createdAt: new Date().toISOString()
  },
  {
    title: 'Lacre Delivery Preto 1.000 Unidades',
    category: 'Embalagens',
    description: 'Lacre de segurança adesivo delivery preto com 1.000 unidades para vedação de caixas, sacolas e embalagens.',
    imageUrl: 'https://i.ibb.co/gMFKqZwS/Lacre-Delivery-Preto-1-000-Unidades.png',
    purchaseUrl: 'https://www.mercadolivre.com.br/lacre-delivery-preto-1000-unidades/up/MLBU1731361907?matt_event_ts=1787681412780&matt_d2id=d5ba9607-1303-4794-810c-d9a3c6ec02c8&matt_tracing_id=a8123af6-a59f-455e-bd38-d6dfb4966ed2#polycard_client=social-profile-middleend&source=lists&type=item&tracking_id=f7a159d8-0718-42fd-8438-10bc6fec68b6&wid=MLB3517689761&sid=storefronts',
    createdAt: new Date().toISOString()
  }
];

const CATEGORIES = ['Todos', 'Embalagens', 'Ingredientes', 'Utensílios', 'Equipamentos', 'Outros'];

export default function AdminSupplies({ settings }: AdminSuppliesProps) {
  const [supplies, setSupplies] = useState<SupplyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SupplyItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<SupplyItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    category: 'Ingredientes',
    description: '',
    imageUrl: '',
    purchaseUrl: ''
  });

  // Load supplies from Firestore, fallback to default seed
  useEffect(() => {
    let isMounted = true;

    const loadSupplies = async () => {
      // 1. Initial local load for instant UI
      const localSaved = localStorage.getItem('egn_insumos_data_v6');
      if (localSaved) {
        try {
          const parsed = JSON.parse(localSaved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const repaired = parsed.map((item: SupplyItem) => ({
              ...item,
              imageUrl: repairSupplyImageUrl(item.imageUrl, item.title)
            }));
            setSupplies(repaired);
            setLoading(false);
          } else {
            const seeded = DEFAULT_SUPPLIES.map((item, idx) => ({ 
              ...item, 
              imageUrl: repairSupplyImageUrl(item.imageUrl, item.title),
              id: `seed-${idx}` 
            }));
            setSupplies(seeded);
            localStorage.setItem('egn_insumos_data_v6', JSON.stringify(seeded));
            setLoading(false);
          }
        } catch {
          const seeded = DEFAULT_SUPPLIES.map((item, idx) => ({ 
            ...item, 
            imageUrl: repairSupplyImageUrl(item.imageUrl, item.title),
            id: `seed-${idx}` 
          }));
          setSupplies(seeded);
          localStorage.setItem('egn_insumos_data_v6', JSON.stringify(seeded));
          setLoading(false);
        }
      } else {
        const seeded = DEFAULT_SUPPLIES.map((item, idx) => ({ 
          ...item, 
          imageUrl: repairSupplyImageUrl(item.imageUrl, item.title),
          id: `seed-${idx}` 
        }));
        setSupplies(seeded);
        localStorage.setItem('egn_insumos_data_v6', JSON.stringify(seeded));
        setLoading(false);
      }

      // 2. Try Firestore sync gracefully
      try {
        const unsub = onSnapshot(collection(db, 'insumos'), (snapshot) => {
          if (!isMounted) return;
          if (!snapshot.empty) {
            const items = snapshot.docs.map(doc => {
              const data = doc.data() as SupplyItem;
              return {
                ...data,
                id: doc.id,
                imageUrl: repairSupplyImageUrl(data.imageUrl, data.title)
              };
            });
            setSupplies(items);
            localStorage.setItem('egn_insumos_data_v6', JSON.stringify(items));
          }
          setLoading(false);
        }, (error) => {
          // Log softly and keep local data active without throwing unhandled exceptions
          console.warn("Insumos: sincronizando em modo local/offline:", error?.message || error);
          if (isMounted) {
            setLoading(false);
          }
        });

        return unsub;
      } catch (err) {
        console.warn("Insumos: inicializado com armazenamento local:", err);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    let unsubscribe: (() => void) | undefined;
    loadSupplies().then(unsub => {
      unsubscribe = unsub;
    });

    return () => {
      isMounted = false;
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (e) {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  const handleRestoreDefaults = () => {
    if (window.confirm('Deseja restaurar as fotos e links originais do catálogo de insumos?')) {
      const seeded = DEFAULT_SUPPLIES.map((item, idx) => ({ 
        ...item, 
        imageUrl: repairSupplyImageUrl(item.imageUrl, item.title),
        id: `seed-${idx}` 
      }));
      setSupplies(seeded);
      localStorage.setItem('egn_insumos_data_v6', JSON.stringify(seeded));
      toast.success('Fotos e insumos restaurados com sucesso!');
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      title: '',
      category: 'Ingredientes',
      description: '',
      imageUrl: '',
      purchaseUrl: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: SupplyItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      category: item.category || 'Ingredientes',
      description: item.description || '',
      imageUrl: item.imageUrl || '',
      purchaseUrl: item.purchaseUrl || ''
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Informe o nome do insumo.');
      return;
    }

    let validPurchaseUrl = formData.purchaseUrl.trim();
    if (validPurchaseUrl && !validPurchaseUrl.startsWith('http://') && !validPurchaseUrl.startsWith('https://')) {
      validPurchaseUrl = `https://${validPurchaseUrl}`;
    }

    setIsSaving(true);
    try {
      if (editingItem) {
        // Edit
        const updated = supplies.map(s => s.id === editingItem.id ? {
          ...s,
          title: formData.title.trim(),
          category: formData.category,
          description: formData.description.trim(),
          imageUrl: formData.imageUrl.trim(),
          purchaseUrl: validPurchaseUrl
        } : s);
        setSupplies(updated);
        localStorage.setItem('egn_insumos_data_v6', JSON.stringify(updated));

        if (!editingItem.id.startsWith('seed-') && !editingItem.id.startsWith('local-')) {
          try {
            await updateDoc(doc(db, 'insumos', editingItem.id), {
              title: formData.title.trim(),
              category: formData.category,
              description: formData.description.trim(),
              imageUrl: formData.imageUrl.trim(),
              purchaseUrl: validPurchaseUrl,
              updatedAt: new Date().toISOString()
            });
          } catch (dbErr) {
            console.warn('Insumos: salvo localmente (offline):', dbErr);
          }
        }
        toast.success('Insumo atualizado com sucesso!');
      } else {
        // Add new
        let newId = `local-${Date.now()}`;
        try {
          const docRef = await addDoc(collection(db, 'insumos'), {
            title: formData.title.trim(),
            category: formData.category,
            description: formData.description.trim(),
            imageUrl: formData.imageUrl.trim(),
            purchaseUrl: validPurchaseUrl,
            createdAt: new Date().toISOString()
          });
          newId = docRef.id;
        } catch (dbErr) {
          console.warn('Insumos: cadastrado localmente (offline):', dbErr);
        }

        const newItem: SupplyItem = {
          id: newId,
          title: formData.title.trim(),
          category: formData.category,
          description: formData.description.trim(),
          imageUrl: formData.imageUrl.trim(),
          purchaseUrl: validPurchaseUrl,
          createdAt: new Date().toISOString()
        };
        const updated = [newItem, ...supplies];
        setSupplies(updated);
        localStorage.setItem('egn_insumos_data_v6', JSON.stringify(updated));
        toast.success('Novo insumo adicionado com sucesso!');
      }

      setIsModalOpen(false);
    } catch (err) {
      console.error('Erro ao salvar insumo:', err);
      toast.error('Erro ao salvar o insumo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: SupplyItem) => {
    try {
      const updated = supplies.filter(s => s.id !== item.id);
      setSupplies(updated);
      localStorage.setItem('egn_insumos_data_v6', JSON.stringify(updated));

      if (!item.id.startsWith('seed-') && !item.id.startsWith('local-')) {
        try {
          await deleteDoc(doc(db, 'insumos', item.id));
        } catch (dbErr) {
          console.warn('Insumos: removido localmente:', dbErr);
        }
      }
      toast.success('Insumo removido com sucesso!');
      setItemToDelete(null);
    } catch (err) {
      console.error('Erro ao remover insumo:', err);
      toast.error('Erro ao remover insumo.');
    }
  };

  // Filtered Items
  const filteredSupplies = useMemo(() => {
    return supplies.filter(item => {
      // Search match
      const query = searchQuery.toLowerCase().trim();
      const matchesQuery = !query || 
        item.title.toLowerCase().includes(query) || 
        (item.description && item.description.toLowerCase().includes(query)) ||
        (item.category && item.category.toLowerCase().includes(query));

      // Category match
      const matchesCategory = selectedCategory === 'Todos' || item.category === selectedCategory;

      return matchesQuery && matchesCategory;
    });
  }, [supplies, searchQuery, selectedCategory]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-14 animate-fade-in">
      {/* Header Banner - Solid opaque card with high contrast */}
      <div className="bg-white/95 backdrop-blur-md p-6 sm:p-7 rounded-3xl border border-gray-200/90 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div 
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm shrink-0 mt-0.5"
            style={{ 
              backgroundColor: `${settings?.primaryColor || '#865d39'}15`,
              border: `1.5px solid ${settings?.primaryColor || '#865d39'}30`
            }}
          >
            <ShoppingBag size={28} style={{ color: settings?.primaryColor || '#865d39' }} />
          </div>
          <div>
            <h1 
              className="text-2xl md:text-3xl font-serif font-black tracking-tight"
              style={{ color: settings?.primaryColor || '#865d39' }}
            >
              Recomendações da Chef
            </h1>
            <p className="text-xs md:text-sm text-gray-700 font-medium max-w-2xl mt-1.5 leading-relaxed">
              Catálogo exclusivo de produtos, embalagens e ingredientes indicados para manter o padrão de qualidade e otimizar as compras.
            </p>
          </div>
        </div>

        {/* Action Buttons in Header */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={handleRestoreDefaults}
            title="Restaurar Fotos e Links Originais"
            className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl text-gray-800 font-bold text-xs uppercase tracking-wider bg-white border border-gray-300 shadow-xs hover:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer"
          >
            <RotateCcw size={14} className="text-gray-500" />
            <span>Restaurar Fotos</span>
          </button>

          <button
            id="btn-add-insumo"
            type="button"
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-white font-bold text-xs uppercase tracking-wider shadow-md hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
            style={{ backgroundColor: settings?.primaryColor || '#2d1f14' }}
          >
            <Plus size={16} />
            <span>Adicionar Recomendação</span>
          </button>
        </div>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-4 border border-gray-200/90 shadow-md space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="input-search-insumos"
              type="text"
              placeholder="Buscar por recomendação da chef ou insumo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-gray-50/90 border border-gray-300 rounded-xl text-xs md:text-sm text-gray-900 placeholder-gray-400 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-all shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer border",
                    isActive
                      ? "shadow-sm text-white border-transparent"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  )}
                  style={isActive ? {
                    backgroundColor: settings?.primaryColor || '#6d5138'
                  } : {}}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid of Supply Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 size={32} className="animate-spin text-[#865d39]" />
          <p className="text-xs text-gray-500 font-medium">Carregando catálogo de insumos...</p>
        </div>
      ) : filteredSupplies.length === 0 ? (
        <div className="text-center py-16 bg-white/70 backdrop-blur-sm rounded-3xl border border-dashed border-gray-300 p-8 space-y-4">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-700">
            <ShoppingBag size={28} />
          </div>
          <h3 className="text-lg font-serif font-black text-gray-800">Nenhum insumo encontrado</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto font-medium">
            {searchQuery || selectedCategory !== 'Todos'
              ? 'Tente ajustar sua busca ou selecionar outra categoria.'
              : 'Clique em "+ Adicionar Insumo" para cadastrar seu primeiro item.'}
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold text-white shadow-md bg-[#2d1f14] hover:opacity-90 transition-all cursor-pointer"
          >
            <Plus size={14} /> Cadastrar Insumo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSupplies.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-3xl border border-gray-200/90 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group"
            >
              {/* Image & Badges Container */}
              <div className="relative h-56 bg-gray-100 overflow-hidden">
                {repairSupplyImageUrl(item.imageUrl, item.title) ? (
                  <img
                    src={repairSupplyImageUrl(item.imageUrl, item.title)}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-2 bg-gradient-to-br from-amber-50/50 to-gray-100">
                    <ImageIcon size={36} className="opacity-40" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Sem Foto</span>
                  </div>
                )}

                {/* Category Badge (Top-Left) */}
                <div className="absolute top-3 left-3">
                  <span className="inline-block px-3 py-1 bg-white/95 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-wider text-gray-900 shadow-sm border border-black/5">
                    {item.category || 'Geral'}
                  </span>
                </div>

                {/* Action Buttons (Top-Right) */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    title="Editar Insumo"
                    className="w-8 h-8 rounded-full bg-white/95 backdrop-blur-md shadow-sm border border-black/5 flex items-center justify-center text-gray-700 hover:text-amber-800 hover:bg-white transition-all cursor-pointer hover:scale-110"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemToDelete(item)}
                    title="Excluir Insumo"
                    className="w-8 h-8 rounded-full bg-white/95 backdrop-blur-md shadow-sm border border-black/5 flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-white transition-all cursor-pointer hover:scale-110"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-1.5">
                  <h3 className="font-serif font-black text-base text-gray-900 leading-snug line-clamp-2">
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="text-xs text-gray-500 font-medium leading-relaxed line-clamp-2">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* CTA Button "ONDE COMPRAR / ACESSAR" - Vibrant Amber/Orange */}
                <div>
                  <a
                    href={item.purchaseUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (!item.purchaseUrl) {
                        e.preventDefault();
                        toast.info('Nenhum link de compra configurado ainda.');
                      }
                    }}
                    className={cn(
                      "w-full py-3 px-4 rounded-2xl font-black text-xs uppercase tracking-wider text-white shadow-md flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer text-center",
                      item.purchaseUrl
                        ? "bg-gradient-to-r from-[#f59e0b] to-[#ea580c] hover:from-[#d97706] hover:to-[#c2410c] hover:shadow-lg active:scale-[0.98]"
                        : "bg-gray-300 cursor-not-allowed opacity-70"
                    )}
                  >
                    <ExternalLink size={14} />
                    <span>Onde Comprar / Acessar</span>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Adicionar / Editar Insumo */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-[#faf8f5]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                    <ShoppingBag size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif font-black text-gray-900">
                      {editingItem ? 'Editar Insumo' : 'Novo Insumo'}
                    </h3>
                    <p className="text-xs text-gray-500 font-medium">
                      Preencha os dados do insumo recomendado
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 rounded-full hover:bg-gray-200/60 text-gray-400 hover:text-gray-700 transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
                    Nome do Insumo / Produto *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Pó de preparo - Pão de mel"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:bg-white focus:ring-2 focus:ring-amber-800/30 focus:border-amber-800 outline-none transition-all"
                  />
                </div>

                {/* Category */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
                    Categoria *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:bg-white focus:ring-2 focus:ring-amber-800/30 focus:border-amber-800 outline-none transition-all cursor-pointer"
                  >
                    <option value="Ingredientes">Ingredientes</option>
                    <option value="Utensílios">Utensílios</option>
                    <option value="Embalagens">Embalagens</option>
                    <option value="Equipamentos">Equipamentos</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
                    Descrição Breve / Dica de Uso
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ex: Preparado em pó especial para pão de mel com textura fofa e alto rendimento."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:bg-white focus:ring-2 focus:ring-amber-800/30 focus:border-amber-800 outline-none transition-all resize-none"
                  />
                </div>

                {/* Image URL */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
                    Link da Imagem (URL)
                  </label>
                  <input
                    type="url"
                    placeholder="https://exemplo.com/foto-do-produto.jpg"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:bg-white focus:ring-2 focus:ring-amber-800/30 focus:border-amber-800 outline-none transition-all"
                  />
                  {formData.imageUrl && (
                    <div className="mt-2 w-24 h-24 rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                      <img
                        src={formData.imageUrl}
                        alt="Pré-visualização"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Purchase URL */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
                    Link "Onde Comprar" (URL do Fornecedor / Loja)
                  </label>
                  <input
                    type="text"
                    placeholder="https://shopee.com.br/... ou https://mercadolivre.com.br/..."
                    value={formData.purchaseUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, purchaseUrl: e.target.value }))}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:bg-white focus:ring-2 focus:ring-amber-800/30 focus:border-amber-800 outline-none transition-all"
                  />
                </div>

                {/* Modal Footer Actions */}
                <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl font-bold text-xs text-gray-600 hover:bg-gray-100 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white shadow-md hover:opacity-90 transition-all cursor-pointer"
                    style={{ backgroundColor: '#2d1f14' }}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        <span>{editingItem ? 'Salvar Alterações' : 'Adicionar Insumo'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {itemToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 space-y-4 text-center"
            >
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>
              <h3 className="font-serif font-black text-lg text-gray-900">Excluir Insumo</h3>
              <p className="text-xs text-gray-500 font-medium">
                Tem certeza que deseja remover <strong>"{itemToDelete.title}"</strong> do catálogo de insumos?
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(itemToDelete)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs text-white bg-red-600 hover:bg-red-700 shadow-md transition-all cursor-pointer"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
