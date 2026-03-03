# CO3404 Distributed Systems - Option 4

## Stage 1: Joke Service

This commit contains the Joke microservice with:
- Express API server (`/joke/:type`, `/types`, `/health`)
- Database abstraction layer supporting MySQL AND MongoDB
- ETL service for processing moderated jokes
- Professional UI for viewing jokes
- Docker support

### Files Added
```
.gitignore
services/joke/
├── app.js              # Main API server
├── etl.js              # ETL consumer service
├── package.json        # Dependencies
├── Dockerfile          # API container
├── Dockerfile.etl      # ETL container
├── database/
│   ├── index.js        # DB switcher (MySQL/MongoDB)
│   ├── db-mysql.js     # MySQL implementation
│   └── db-mongo.js     # MongoDB implementation
└── public/
    ├── index.html      # UI
    ├── styles.css      # Styling
    └── script.js       # Frontend logic
```

### Next: Stage 2 - Submit Service
