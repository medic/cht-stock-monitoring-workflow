const process = require('process');
const path = require('path');
const ExcelJS = require('exceljs');
const fs = require('fs');

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

const cleanUp = async (workingDir, createdAppFormFiles) => {
  const processDir = path.join(workingDir,'test/project-config/');
  for(const createdAppFormFile of createdAppFormFiles){
    const filePath = path.join(processDir, 'forms', 'app', createdAppFormFile);
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

const readOutputFiles = async (filesNames) => {
  const projectPath = process.cwd(); 
  const formPath = path.join(projectPath, 'forms', 'app', filesNames[0]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(formPath);
  const propertiesFileContent = fs.readFileSync(
    path.join(projectPath, 'forms', 'app', filesNames[1]), 
    {encoding: 'utf-8'}
  );

  return {
    workbook,
    propertiesFileContent
  };

};

module.exports = {
  setDirToprojectConfig,
  currentWorkingDirectory,
  revertBackToProjectHome,
  cleanUp,
  readOutputFiles,
  readDataFromXforms
};



