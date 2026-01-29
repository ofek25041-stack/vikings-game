// Simple deployment using SSH tunneling (no packages needed!)
const { spawn } = require('child_process');
const http = require('http');

console.log('==========================================');
console.log('   SIMPLE DEPLOYMENT HELPER');
console.log('==========================================\n');

console.log('Your server is running on: http://localhost:3000\n');
console.log('To share it publicly, you have a few options:\n');

console.log('OPTION 1: Use serveo.net (easiest!)');
console.log('------------------------------------------');
console.log('Open a new CMD window and run:');
console.log('  ssh -R 80:localhost:3000 serveo.net\n');
console.log('You\'ll get a public URL like: https://xxx.serveo.net\n');

console.log('OPTION 2: Port forwarding on your router');
console.log('------------------------------------------');
console.log('1. Find your local IP: ipconfig');
console.log('2. Forward port 3000 to your computer');
console.log('3. Share: http://YOUR_PUBLIC_IP:3000\n');

console.log('OPTION 3: Deploy to free hosting');
console.log('------------------------------------------');
console.log('Upload to: render.com, railway.app, or vercel.com\n');

console.log('==========================================');
console.log('Press Ctrl+C when done');
console.log('==========================================\n');

// Keep script running
setInterval(() => { }, 1000 * 60);
