module.exports = {
  mockConfigsWithNoFeauture: {
    features: {
      no_feature: {
        form_name: 'no_form'
      },
    },
  },
  stockMonitoringConfigs: {
    features: {
      stock_out: {
        form_name: 'stock_out',
        formular: 'item_danger_qty',
        title: { 
          en: 'Stock Out Title', 
          fr: 'Titre du Stock' 
        },
      },
      stock_return: {
        form_name: 'stock_return',
        title: {
          en: 'Stock Return',
          fr: 'Retour de Stock'
        },
        confirmation: {
          form_name: 'stock_returned',
          title: {
            en: 'Stock Returned',
            fr: 'Stock Retourné'
          },
        }
      }
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
      malaria: {
        name: 'malaria',
        label: {
          fr: 'Categorie'
        },
        description: {
          fr: 'Categorie'
        }
      }
    },
    useItemCategory: true,
    defaultLanguage: 'fr',
  },
  stockMonitoringScenario: {
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
      0,
    ],
    invalidCommandInitScenario: [
      'test', 
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
      0,
    ],
    invalidFeatureCommandScenario: [
      'minus', 'data', 'stock_out', 'stock_out', 'item_danger_qty', ['Stock Out', 'Stock Out']
    ],
  },

  stockOutScenario: {
    addStockOutFeatureScenario: [
      'add', 'feature', 'stock_out', 'stock_out', 'item_danger_qty', ['Stock Out', 'Stock Out']
    ],
    productsScenario: [
      'paracetamol_at_hand___set',
      'paracetamol_at_hand___unit',
      'paracetamol_required___set',
      'paracetamol_required___unit'
    ],
  },

  stockCountScenario: {
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

  stockReturnScenario: {
    addFeatureScenario: [
      'add', 
      'feature', 
      'stock_return',
      ['Stock Return', 'Retour de Stock'],
      'stock_returned',
      ['Stock Returned', 'Stock Retourné']
    ],
    productCategoryScenario: [
      'malaria'
    ],
    productsScenario: [
      'paracetamol___set',
      'paracetamol___unit',
    ],
    productReturnedScenario: [
      'paracetamol__return___set',
      'paracetamol__return___unit',
      'paracetamol_received',
      'paracetamol___set',
      'paracetamol___unit',
      'paracetamol_received_qty',
      'paracetamol___count',
    ]
  }
};






