const serve = require('serve');
const path = require('path');

const server = serve(path.join(__dirname), {
  port: process.env.PORT || 3000,
  single: true,
  ignore: ['node_modules']
});

console.log(`NOVA Swarm Live serving on port ${process.env.PORT || 3000}`);
