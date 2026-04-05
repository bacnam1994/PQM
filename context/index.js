const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.database();

/**
 * Trigger khi một Sản phẩm (Product) bị xóa.
 * Tự động dọn dẹp các TCCS và Batches liên quan.
 */
exports.onProductDeleted = functions.database.ref('/products/{productId}')
  .onDelete(async (snap, context) => {
    const productId = context.params.productId;
    const updates = {};

    // 1. Tìm và xóa TCCS
    const tccsSnap = await db.ref('tccs').orderByChild('productId').equalTo(productId).once('value');
    if (tccsSnap.exists()) {
      tccsSnap.forEach(child => { updates[`tccs/${child.key}`] = null; });
    }

    // 2. Tìm và xóa Batches
    const batchesSnap = await db.ref('batches').orderByChild('productId').equalTo(productId).once('value');
    if (batchesSnap.exists()) {
      batchesSnap.forEach(child => { updates[`batches/${child.key}`] = null; });
    }

    if (Object.keys(updates).length > 0) {
      return db.ref().update(updates);
    }
    return null;
  });

/**
 * Trigger khi một Lô (Batch) bị xóa.
 * Tự động dọn dẹp TestResults, InventoryIn, InventoryOut liên quan.
 */
exports.onBatchDeleted = functions.database.ref('/batches/{batchId}')
  .onDelete(async (snap, context) => {
    const batchId = context.params.batchId;
    const updates = {};
    const collections = ['testResults', 'inventoryIn', 'inventoryOut'];
    
    for (const collection of collections) {
      const recordsSnap = await db.ref(collection).orderByChild('batchId').equalTo(batchId).once('value');
      if (recordsSnap.exists()) {
        recordsSnap.forEach(child => { updates[`${collection}/${child.key}`] = null; });
      }
    }

    if (Object.keys(updates).length > 0) {
      return db.ref().update(updates);
    }
    return null;
  });