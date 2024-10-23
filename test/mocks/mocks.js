module.exports = {
  mockConfigs: {
    features: {
      stock_order: {
        actors: [
          {
            contact_type: 'c62_chw',
            role: 'chw',
            place_type: 'c60_chw_site'
          }
        ],
        form_name: 'stock_order',
        title: {
          en: 'Stock Order',
          fr: 'Commande de Stock'
        },
        stock_supply: {
          form_name: 'stock_order_supply',
          title: {
            en: 'Stock Order Supply',
            fr: 'Livraison de Commande de Stock'
          }
        }
      }
    },
    languages: ['en', 'fr'],
    items: {
      product: {
        name: 'product',
        label: {
          en: 'Product',
          fr: 'Produit'
        },
        isInSet: 'Y',
        set: {
          label: {
            en: 'Box of 8',
            fr: 'Boite de 8'
          },
          count: '8'
        },
        unit: {
          label: {
            en: 'Tablet',
            fr: 'Comprimes'
          }
        },
        warning_total: '20',
        danger_total: '15',
        max_total: '15',
        category: 'malaria'
      }
    },
    categories: {
      category: {
        name: 'category',
        label: {
          fr: 'Categorie',
          en: 'Category'
        },
        description: {
          fr: 'Categorie',
          en: 'Category'
        }
      }
    },
    defaultLanguage: 'fr',
    last_update_date: '2024-10-21T11:09:33.013Z'
  },
  mockConfigsWithNoFeauture: {
    features: {
      no_feauture: {
        form_name: 'no_feature',
      }
    },
  },
  stockCountScenario: {
    initScenario: [
      'init', 
      '2_levels', 
      'c62_chw', 
      'chw', 
      'c52_supervisor', 
      'supervisor', 
      'Y', 
      'stock_count', 
      '[{contact_type: \'c62_chw\', role: \'chw\', place_type: \'c60_chw_site\' },{contact_type: \'c52_supervisor\',role: \'supervisor\',place_type: \'c50_supervision_area\'}]',
      'action', 
      'end_of_week', 
      ['Stock count', 'Stock count'],
      'patient_assessment_under_5',
      'Y',
      'now()',
      'malaria',
      ['Category', 'Categorie'],
      ['Category', 'Categorie'],
      'paracetamol',
      ['Paracetamol', 'Paracetamole'],
      'Y',
      ['Box of 8', 'Boite de 8'],
      8,
      ['Tablet', 'Comprimes'],
      20,
      15,
      15,
      'by_user',
      0
    ],
    productCategoryScenario: [
      'malaria'
    ],
    productsScenario: [
      'paracetamol___set',
      'paracetamol___unit',
      'paracetamol',
      'paracetamol___count'
    ]

  },

  stockOrderScenario: {
    initScenario: [
      'init', 
      '2_levels', 
      'c62_chw', 
      'chw', 
      'c52_supervisor', 
      'supervisor', 
      'Y', 
      'stock_count', 
      '[{contact_type: \'c62_chw\', role: \'chw\', place_type: \'c60_chw_site\' },{contact_type: \'c52_supervisor\',role: \'supervisor\',place_type: \'c50_supervision_area\'}]',
      'action', 
      'end_of_week', 
      ['Stock Count', 'Stock Count'],
      'patient_assessment_under_5',
      'Y',
      'now()',
      'malaria',
      ['Category', 'Categorie'],
      ['Category', 'Categorie'],
      'paracetamol',
      ['Paracetamol', 'Paracetamole'],
      'Y',
      ['Box of 8', 'Boite de 8'],
      8,
      ['Tablet', 'Comprimes'],
      20,
      15,
      15,
      'by_user',
      0
    ],
    addStockOrderFeatureScenario: [
      'add', 
      'feature', 
      'stock_order', 
      '[{contact_type: \'c62_chw\', role: \'chw\', place_type: \'c60_chw_site\' },{contact_type: \'c52_supervisor\',role: \'supervisor\',place_type: \'c50_supervision_area\'}]',
      'stock_order', 
      'Stock Order', 
      ['Stock Order', 'Stock Order'], 
      ['Stock Order Supply', 'Stock Order Supply'],
      'stock_order_supply',
      'stock_supply',
      ['Stock Supply', 'Stock Supply'],
      true,
      'stock_received',
      ['Stock Received', 'Stock Received'],
      'stock_discrepancy_resolution',
      ['Stock Discrepancy Resolution', 'Stock Discrepancy Resolution']
    ],
    productCategoryScenario: [
      'malaria'
    ],
    
    productsScenario: [
      'paracetamol___set',
      'paracetamol___unit',
      'paracetamol',
      'paracetamol___count'
    ],

    stockOrderProductScenario: [
      '___paracetamol',
      'paracetamol_before',
      'paracetamol___current___set',
      'paracetamol___current___unit',
      'paracetamol___set',
      'paracetamol___unit',
      'paracetamol_order_qty',
      'paracetamol___after___set',
      'paracetamol___after___unit',
      'paracetamol_after_note',
      'paracetamol___count',
      'paracetamol_after'
    ],
    stockSupplyProductsScenario: [
      'malaria_items_selected',
      '___paracetamol',
      'paracetamol___set',
      'paracetamol___unit',
      'supply_paracetamol',
      'paracetamol___count'
    ]

  },
};
