const process = require('process');
const path = require('path');
const fs = require('fs-extra');
const ExcelJS = require('exceljs');

const currentWorkingDirectory = () =>{
  return process.cwd();
};

function setDirToprojectConfig(){
  const processDir = process.cwd();
  process.chdir(path.join(processDir,'test/project-config/'));
}

const revertBackToProjectHome = (projectHome) =>{
  process.chdir(projectHome);
};

const cleanUp = async(workingDir, fileNames) => {
  const processDir = path.join(workingDir,'test/project-config/');
  for(const formFile of fileNames){
    const filePath = path.join(processDir, 'forms', 'app', formFile);
    fs.stat(filePath, (error) => {
      if (!error) {
        fs.unlinkSync(filePath);
      }
    });
  }

  // Removing the stock monitoring init file and stock count file
  const stockMonitoringInitPath = path.join(processDir, 'stock-monitoring.config.json');
  fs.stat(stockMonitoringInitPath, (error) => {
    if (!error) {
      fs.unlinkSync(stockMonitoringInitPath);
    }
  });

};

const readDataFromXforms = async (productCategoryScenario, productsScenario, fileName) => {
  const projectPath = process.cwd(); 
  const productCategoryList = [];
  const productsList = [];

  const workbook = new ExcelJS.Workbook();
  const xlsx =  workbook.xlsx;
  await xlsx.readFile(path.join(projectPath, 'forms', 'app', fileName));
  const surveyWorkSheet = workbook.getWorksheet('survey');
  const nameCol = surveyWorkSheet.getColumn('B');
  let productIndex = 0;
  let productCatIndex =0;
  nameCol.eachCell(function(cell){

    if(productCategoryScenario !== undefined && productCategoryScenario.length > 0){
      if(cell.value === productCategoryScenario[productCatIndex] && productCatIndex < productCategoryScenario.length){
        productCategoryList.push(cell.value);
        productCatIndex ++;
        productIndex = 0;
      }
    }

    if(productsScenario !== undefined && productsScenario.length > 0){
      if(cell.value === productsScenario[productIndex] && productIndex < productsScenario.length){
        productsList.push(cell.value);
        productIndex ++;
      }
    }
  });

  return {
    productsList,
    productCategoryList
  };

};

const writeTranslationMessages = async (frMessages, enMessages, workingDir) => {
  const translationFiles = fs.readdirSync(path.join(workingDir, 'translations'));
  for(const translationFile of translationFiles){
    if(translationFile.includes('messages-en')) {
      await fs.writeFile(path.join(workingDir, 'translations', translationFile), enMessages.toString().replaceAll(',', ''));
    }else{
      await fs.writeFile(path.join(workingDir, 'translations', translationFile), frMessages.toString().replaceAll(',', ''));
    }
  }
};

const resetTranslationMessages = async (workingDir) => {
  const translationFiles = fs.readdirSync(path.join(workingDir, 'translations'));
  for(const translationFile of translationFiles){
    await fs.truncate(path.join(workingDir, 'translations', translationFile), 0, function () {});
  }
};


module.exports = {
  setDirToprojectConfig,
  currentWorkingDirectory,
  revertBackToProjectHome,
  cleanUp,
  readDataFromXforms,
  writeTranslationMessages,
  resetTranslationMessages
};



