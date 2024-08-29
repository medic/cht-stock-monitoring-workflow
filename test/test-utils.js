const process = require('process');
const path = require('path');

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

module.exports = {
  setDirToprojectConfig,
  currentWorkingDirectory,
  revertBackToProjectHome
};



