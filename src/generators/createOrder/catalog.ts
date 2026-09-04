/**
 * Sample item catalog used by the createOrder generator.
 *
 * This is deliberately plain data: swap the entries for your own item master
 * (ItemID / UnitOfMeasure / ProductClass must exist in your Sterling instance,
 * otherwise createOrder rejects the line with an item-not-found error).
 */

export interface CatalogItem {
  itemId: string;
  itemDesc: string;
  productClass: string;
  unitOfMeasure: string;
  category: string;
}

export const DEFAULT_CATALOG: readonly CatalogItem[] = [
  { itemId: 'SKU-1001', itemDesc: 'Wireless Mouse, 2.4GHz', productClass: 'GOOD', unitOfMeasure: 'EACH', category: 'COMPUTER' },
  { itemId: 'SKU-1002', itemDesc: 'Mechanical Keyboard, 87-key', productClass: 'GOOD', unitOfMeasure: 'EACH', category: 'COMPUTER' },
  { itemId: 'SKU-1003', itemDesc: '27" 4K IPS Monitor', productClass: 'GOOD', unitOfMeasure: 'EACH', category: 'COMPUTER' },
  { itemId: 'SKU-1004', itemDesc: 'USB-C Docking Station', productClass: 'GOOD', unitOfMeasure: 'EACH', category: 'COMPUTER' },
  { itemId: 'SKU-1005', itemDesc: 'Noise Cancelling Headset', productClass: 'GOOD', unitOfMeasure: 'EACH', category: 'AUDIO' },
  { itemId: 'SKU-1006', itemDesc: 'Bluetooth Speaker, Portable', productClass: 'GOOD', unitOfMeasure: 'EACH', category: 'AUDIO' },
  { itemId: 'SKU-1007', itemDesc: 'Laptop Stand, Aluminium', productClass: 'GOOD', unitOfMeasure: 'EACH', category: 'ACCESSORY' },
  { itemId: 'SKU-1008', itemDesc: 'Webcam 1080p with Mic', productClass: 'GOOD', unitOfMeasure: 'EACH', category: 'ACCESSORY' },
  { itemId: 'SKU-2001', itemDesc: 'Office Chair, Ergonomic', productClass: 'GOOD', unitOfMeasure: 'EACH', category: 'FURNITURE' },
  { itemId: 'SKU-2002', itemDesc: 'Height Adjustable Desk', productClass: 'GOOD', unitOfMeasure: 'EACH', category: 'FURNITURE' },
  { itemId: 'SKU-2003', itemDesc: 'Desk Lamp, LED Dimmable', productClass: 'GOOD', unitOfMeasure: 'EACH', category: 'FURNITURE' },
  { itemId: 'SKU-3001', itemDesc: 'Cotton Crew Neck T-Shirt', productClass: 'GOOD', unitOfMeasure: 'EACH', category: 'APPAREL' },
  { itemId: 'SKU-3002', itemDesc: 'Merino Wool Sweater', productClass: 'GOOD', unitOfMeasure: 'EACH', category: 'APPAREL' },
  { itemId: 'SKU-3003', itemDesc: 'Running Shoes, Unisex', productClass: 'GOOD', unitOfMeasure: 'EACH', category: 'APPAREL' },
  { itemId: 'SKU-3004', itemDesc: 'Waterproof Rain Jacket', productClass: 'GOOD', unitOfMeasure: 'EACH', category: 'APPAREL' },
  { itemId: 'SKU-4001', itemDesc: 'Stainless Steel Water Bottle', productClass: 'GOOD', unitOfMeasure: 'EACH', category: 'HOME' },
  { itemId: 'SKU-4002', itemDesc: 'Espresso Machine, 15 bar', productClass: 'GOOD', unitOfMeasure: 'EACH', category: 'HOME' },
  { itemId: 'SKU-4003', itemDesc: 'Air Purifier HEPA Filter', productClass: 'GOOD', unitOfMeasure: 'EACH', category: 'HOME' },
  { itemId: 'SKU-4004', itemDesc: 'Cast Iron Skillet 26cm', productClass: 'GOOD', unitOfMeasure: 'EACH', category: 'HOME' },
  { itemId: 'SKU-5001', itemDesc: 'Yoga Mat, 6mm', productClass: 'GOOD', unitOfMeasure: 'EACH', category: 'SPORTS' },
  { itemId: 'SKU-5002', itemDesc: 'Adjustable Dumbbell Set', productClass: 'GOOD', unitOfMeasure: 'EACH', category: 'SPORTS' },
  { itemId: 'SKU-5003', itemDesc: 'Camping Tent, 2 Person', productClass: 'GOOD', unitOfMeasure: 'EACH', category: 'SPORTS' },
  { itemId: 'SRV-9001', itemDesc: 'Extended Warranty, 2 Years', productClass: 'GOOD', unitOfMeasure: 'EACH', category: 'SERVICE' },
  { itemId: 'SRV-9002', itemDesc: 'Installation Service', productClass: 'GOOD', unitOfMeasure: 'EACH', category: 'SERVICE' },
];
