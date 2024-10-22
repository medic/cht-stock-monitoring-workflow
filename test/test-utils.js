const process = require('process');
const path = require('path');
const fs = require('fs-extra');

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

const cleanUp = (workingDir) => {
  const processDir = path.join(workingDir,'test/project-config/');
  const stockOutFormFiles = ['stock_out.xlsx', 'stock_count.xlsx', 'stock_count.properties.json', 'stock_out.properties.json'];
  for(const formFile of stockOutFormFiles){
    fs.unlinkSync(path.join(processDir, 'forms', 'app', formFile));
  }

  // Removing the stock monitoring init file and stock count file
  const stockMonitoringInitPath = path.join(processDir, 'stock-monitoring.config.json');
  fs.stat(stockMonitoringInitPath, (error) => {
    if (!error) {
      fs.unlinkSync(stockMonitoringInitPath);
    }
  });

};

module.exports = {
  setDirToprojectConfig,
  currentWorkingDirectory,
  revertBackToProjectHome,
  cleanUp,
};



