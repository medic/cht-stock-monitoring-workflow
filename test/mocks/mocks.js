module.exports = {
  mockConfigsWithNoFeauture: {
    features: {
      no_feature: {
        form_name: 'no_form'
      },
    },
  },
  stockSupplyConfig: {
    features: {
      stock_supply: {
        form_name: 'stock_supply',
        title: {
          en: 'Stock Supply',
          fr: 'Livraison de Stock'
        },
        confirm_supply: {
          form_name: 'stock_received',
          title: {
            en: 'Stock Received',
            fr: 'Réception de Stock'
          },
          active: true
        },
        discrepancy: {
          form_name: 'stock_discrepancy_resolution',
          title: {
            en: 'Stock Discrepancy Resolution',
            fr: 'Résolution de conflits'
          }
        }
      },
    },
    levels: {
      1: { 
        contact_type: 'c62_chw',
        role: 'chw',
        place_type: 'c62_chw_site'
      },
      2: { 
        contact_type: 'c52_supervisor',
        role: 'supervisor',
        place_type: 'c50_supervision_area'
      },
    },
    languages: ['en', 'fr'],
    items: {
      paracetamol: {
        name: 'paracetamol',
        label: {
          en: 'Paracetamol',
          fr: 'Paracetamole'
        },
        isInSet: true,
        set: {
          label: {
            en: 'Box of 8',
            fr: 'Boite de 8'
          },
          count: 8
        },
        unit: {
          label: {
            en: 'Tablet',
            fr: 'Comprimes'
          }
        },
        warning_total: '20',
        danger_total: '15',
        max_total: '50',
        category: 'malaria'
      }
    },
    categories: {
      malaria: {
        name: 'malaria',
        label: {
          fr: 'Malaria'
        },
        description: {
          fr: 'Malaria'
        }
      }
    },
    useItemCategory: true,
    defaultLanguage: 'fr',
  },
  stockSupplyScenario: {
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
    addStockSupplyFeature: [
      'add', 
      'feature', 
      'stock_supply',
      ['Stock Supply', 'Livraison de Stock'],
      true,
      'stock_received',
      ['Stock Received', 'Réception de Stock'],
      'stock_discrepancy_resolution',
      ['Stock Discrepancy Resolution', 'Résolution de conflits']
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

  }
};






