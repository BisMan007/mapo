# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the backend and run the production server
FROM node:20-alpine
WORKDIR /app

# Copy root configurations
COPY package*.json ./

# Copy backend configurations and install dependencies
COPY backend/package*.json ./backend/
RUN npm install --prefix backend

# Copy backend source and compile TypeScript
COPY backend/ ./backend/
RUN npm run build --prefix backend

# Copy compiled frontend assets from Stage 1 into the backend's expected path
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose production port
EXPOSE 3001

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Command to run the Express backend production server
CMD ["npm", "start", "--prefix", "backend"]
