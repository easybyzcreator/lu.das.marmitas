import { db } from '../firebase';
import { doc, getDoc, setDoc, getDocs, collection, arrayUnion, updateDoc } from 'firebase/firestore';
import { initialCategories, initialProducts } from '../data/defaultCatalog';
import { cleanFirestoreData, getCanonicalDishKey } from './utils';

let isSeeding = false;

export async function ensureDefaultCatalogSeeded() {
  if (isSeeding) return;
  isSeeding = true;

  try {
    const setupDocRef = doc(db, 'configuracoes', 'app_setup');
    const setupSnap = await getDoc(setupDocRef);
    const setupData = setupSnap.exists() ? setupSnap.data() : null;
    const deletedCategoryIds: string[] = setupData?.deletedCategoryIds || [];
    const deletedProductIds: string[] = setupData?.deletedProductIds || [];

    // Check existing categories in Firestore
    const catSnap = await getDocs(collection(db, 'categorias'));
    const existingCatIds = new Set(catSnap.docs.map(d => d.id));

    // For any initial category that does not exist in Firestore and was NOT explicitly deleted, save it to Firestore
    for (const cat of initialCategories) {
      if (!existingCatIds.has(cat.id) && !deletedCategoryIds.includes(cat.id)) {
        await setDoc(doc(db, 'categorias', cat.id), cleanFirestoreData(cat), { merge: true });
      }
    }

    // Check existing products in Firestore
    const prodSnap = await getDocs(collection(db, 'produtos'));
    const existingProdIds = new Set(prodSnap.docs.map(d => d.id));

    // For any initial product that does not exist in Firestore and was NOT explicitly deleted, save it to Firestore
    for (const prod of initialProducts) {
      if (!existingProdIds.has(prod.id) && !deletedProductIds.includes(prod.id)) {
        await setDoc(doc(db, 'produtos', prod.id), cleanFirestoreData(prod), { merge: true });
      }
    }

    // Auto-sync stock across counterpart/duplicate products with the same canonical dish title
    const allProdsSnap = await getDocs(collection(db, 'produtos'));
    const allProducts = allProdsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

    const dishGroups: Record<string, any[]> = {};
    for (const p of allProducts) {
      if (p.isCombo) continue;
      const key = getCanonicalDishKey(p.title);
      if (!key) continue;
      if (!dishGroups[key]) dishGroups[key] = [];
      dishGroups[key].push(p);
    }

    for (const [, group] of Object.entries(dishGroups)) {
      const trackedItems = group.filter(p => p.trackStock === true);
      if (trackedItems.length > 0) {
        // Encontrar maior quantidade válida definida para sincronizar irmãos
        const maxStock = Math.max(...trackedItems.map(p => typeof p.stockQuantity === 'number' ? p.stockQuantity : 0));
        for (const p of group) {
          if (p.trackStock !== true || p.stockQuantity !== maxStock) {
            try {
              await updateDoc(doc(db, 'produtos', p.id), {
                trackStock: true,
                stockQuantity: maxStock
              });
            } catch (err) {
              console.warn('Erro ao sincronizar estoque do prato:', p.title, err);
            }
          }
        }
      }
    }

    // Limpar IDs inexistentes de combos
    for (const p of allProducts) {
      if (p.isCombo && Array.isArray(p.comboAllowedProductIds)) {
        const validIds = p.comboAllowedProductIds.filter(id => allProducts.some(pr => pr.id === id));
        if (validIds.length !== p.comboAllowedProductIds.length) {
          try {
            await updateDoc(doc(db, 'produtos', p.id), {
              comboAllowedProductIds: validIds
            });
          } catch (e) {}
        }
      }
    }

    // Mark setup as completed
    await setDoc(setupDocRef, {
      seeded: true,
      seededAt: setupData?.seededAt || new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('ensureDefaultCatalogSeeded error (will retry next time):', err);
  } finally {
    isSeeding = false;
  }
}

export async function markCategoryAsDeleted(id: string) {
  try {
    await setDoc(doc(db, 'configuracoes', 'app_setup'), {
      deletedCategoryIds: arrayUnion(id)
    }, { merge: true });
  } catch (e) {
    console.warn('Error marking category as deleted:', e);
  }
}

export async function markProductAsDeleted(id: string) {
  try {
    await setDoc(doc(db, 'configuracoes', 'app_setup'), {
      deletedProductIds: arrayUnion(id)
    }, { merge: true });
  } catch (e) {
    console.warn('Error marking product as deleted:', e);
  }
}
