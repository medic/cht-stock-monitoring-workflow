module.exports = {
  mockConfigsStockReturn: {
    features: {
      stock_return: {
        form_name: 'stock_return',
        title: {
          en: 'Stock Return',
          fr: 'Retour de Stock'
        }
      }
    },
    levels:{
      1: {
        contact_type: 'c62_chw', 
        role: 'chw',
        place_type: 'c60_chw_site' 
      },
      2:{
        contact_type: 'c52_supervisor',
        role: 'supervisor',
        place_type: 'c50_supervision_area'
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
    }
  },
  stockReturnScenario: {
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






