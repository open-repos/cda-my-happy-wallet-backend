// Target server hostname or IP address
const SERVER_IP = process.env.SERVER_IP ? process.env.SERVER_IP.trim() : '';
// Target server username
const SERVER_USER = process.env.SERVER_USER ? process.env.SERVER_USER.trim() : '';
// Target server application path
const TARGET_SERVER_APP_PATH = `/home/${SERVER_USER}/projet-cda-00/projet-00-myhappywallet-backend`;
// Your repository
const REPO = 'git@gitlab.com:formation-cda1/projet-chef-oeuvre-rapport/projet-00-myhappywallet-backend.git';

module.exports = {
  apps : [{
    name:  'myhappywallet',
    script: './dist/index.js',
    watch: 'true',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 4201
    }
  }],

 deploy: {
   development: {
     user: SERVER_USER,
     host: SERVER_IP,
    //  key: "~/.ssh/id_ed25519",
     ref: 'origin/develop',
     repo: REPO,
     ssh_options: 'StrictHostKeyChecking=no',
     path: TARGET_SERVER_APP_PATH,
      // 'post-deploy' : 'npm install && pm2 reload ecosystem.config.js --env development',
      "post-deploy": "cp ../.env ./ && npm i && npm run build && pm2 startOrGracefulReload ecosystem.config.js && pm2 save"
      // "post-deploy": "npm i --no-optional && npm run build && pm2 startOrGracefulReload ecosystem.json --env production && pm2 save"
      // 'post-deploy': 'git pull && npm install && npm run build && pm2 startOrGracefulReload pm2-ecosystem.config.js --env production && pm2 save',
    },
    production: {
      user: SERVER_USER,
      host: SERVER_IP,
      ref: 'main',
      repo: REPO,
      ssh_options: 'StrictHostKeyChecking=no',
      path: TARGET_SERVER_APP_PATH,
      //  'post-deploy' : 'npm install && pm2 reload ecosystem.config.js --env production',
       "post-deploy": "npm i --no-optional && npm run build && pm2 startOrGracefulReload ecosystem.json --env production && pm2 save"
       // "post-deploy": "npm i --no-optional && npm run build && pm2 startOrGracefulReload ecosystem.json --env production && pm2 save"
       // 'post-deploy': 'git pull && npm install && npm run build && pm2 startOrGracefulReload pm2-ecosystem.config.js --env production && pm2 save',
     }
}
}