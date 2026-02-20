# Hosting Guide for Electrospot Backend

This guide explains how to deploy your backend and connect your Android app to it.

## 1. Quick Deployment Options

### A. Render (Recommended)
1. Sign up at [Render.com](https://render.com).
2. Create a new "Web Service".
3. Connect your GitHub repository.
4. Render will automatically detect the `Procfile` and use `node server.js`.
5. Add your Environment Variables in the "Environment" tab (refer to `.env.example`).

### B. Railway
1. Sign up at [Railway.app](https://railway.app).
2. Create a new project from your GitHub repo.
3. Railway will detect the `Dockerfile` or `package.json`.
4. Add your Environment Variables.

### C. Docker
If you have a VPS (DigitalOcean, AWS, etc.), use the included `Dockerfile`:
```bash
docker build -t electrospot-backend .
docker run -p 3000:3000 --env-file .env electrospot-backend
```

## 2. Environment Variables (Required)

Ensure you set these in your hosting provider's dashboard:
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`: Your Supabase connection details.
- `JWT_SECRET`: A long random string.
- `SERPER_API_KEY`: Your API key for station searching.
- `NODE_ENV`: Set to `production`.

## 3. Connecting your Android App

### Finding the Server URL
Once deployed, your hosting provider will give you a URL (e.g., `https://electrospot-backend.onrender.com`).

### Local Testing (Android Emulator)
If you are running the backend locally and want to connect from an Android Emulator:
1. Use the special IP `10.0.2.2` instead of `localhost`.
2. Example URL: `http://10.0.2.2:3000`

### Physical Device Testing
1. Ensure your phone and PC are on the same Wi-Fi.
2. Find your PC's local IP (Run `ipconfig` on Windows).
3. Example URL: `http://192.168.1.XX:3000`

### Updating the Flutter App
In your Flutter/Dart code:
1. Locate your configuration file (e.g., `lib/constants.dart` or where you define the `baseUrl`).
2. Update the `baseUrl` to your deployed URL.

```dart
// Example
const String baseUrl = 'https://your-backend-url.com';
```

## 4. Production Checklist
- [ ] Database SSL enabled (`DB_SSL=true`).
- [ ] Request/Response logs monitoring.
- [ ] CORS restricted to your admin dashboard URL (if applicable).
