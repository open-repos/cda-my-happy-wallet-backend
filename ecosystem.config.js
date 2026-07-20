// Target server hostname or IP address
const SERVER_IP = process.env.SERVER_IP ? process.env.SERVER_IP.trim() : "";
// Target server username
const SERVER_USER = process.env.SERVER_USER
  ? process.env.SERVER_USER.trim()
  : "";
// Target server application path
const TARGET_SERVER_APP_PATH = process.env.DEPLOY_PATH
  ? process.env.DEPLOY_PATH.trim()
  : `/home/${SERVER_USER}/projet-cda-00/projet-00-myhappywallet-backend`;
const DEPLOY_REF = process.env.DEPLOY_REF
  ? process.env.DEPLOY_REF.trim()
  : "origin/main";
// Your repository
const REPO =
  "git@gitlab.com:formation-cda1/projet-chef-oeuvre-rapport/projet-00-myhappywallet-backend.git";

module.exports = {
  apps: [
    {
      name: "myhappywallet",
      script: "./dist/index.js",
      watch: false,
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 4201,
      },
    },
  ],
  deploy: {
    production: {
      user: SERVER_USER,
      host: SERVER_IP,
      ref: DEPLOY_REF,
      repo: REPO,
      path: TARGET_SERVER_APP_PATH,
      "post-deploy":
        "cp ../.env ./ && npm ci && npm run prisma:generate && npm run db:deploy && npm run build && pm2 startOrGracefulReload ecosystem.config.js --env production && pm2 save",
    },
  },
};
