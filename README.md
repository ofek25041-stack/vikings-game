# Vikings Strategy Game

A real-time multiplayer strategy game built with Node.js

## 🎮 Game Features

- Build and upgrade your Viking city
- Train armies and conquer territories  
- Join or create clans with fortress system
- Real-time PvP battles with march visualization
- Resource management and trading
- AI opponents and missions
- Tutorial system for new players

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start the server
node server.js

# Or use the batch file
start_server.bat
```

Game will be available at: `http://localhost:3000`

### Cloud Deployment (Render.com)

```bash
# Run the deployment script
deploy_to_render.bat
```

Follow the prompts to deploy to Render.com for free hosting!

## 📋 Requirements

- Node.js 14+ 
- npm

## 🏗️ Project Structure

```
vikings-game/
├── server.js           # Main server
├── index.html          # Game client
├── main.js            # Client game logic
├── clan.js            # Clan system
├── data/              # JSON file storage
│   ├── users/        # Player data
│   └── clans/        # Clan data
├── assets/            # Images and resources
└── *.css             # Stylesheets
```

## 🌐 Live Deployment

The game can be deployed for free to:
- Render.com (recommended)
- Railway.app
- Vercel (frontend only)

See `implementation_plan.md` for detailed deployment guide.

## 🎯 Current Status

**Phase 1: Stability & Foundations**
- ✅ Core gameplay implemented
- ✅ Clan system functional
- ✅ March visualization
- ✅ Cloud deployment ready
- 🔄 Mobile optimization in progress

## 📝 License

MIT License - feel free to use and modify!

## 🤝 Contributing

This is a personal project, but feedback and suggestions are welcome!

---

Built with ❤️ by Ofek
