# Use Node.js 18 alpine for a small image size
FROM node:18-alpine

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json
COPY package*.json ./

# Install dependencies
# Using 'npm ci' for reproducible builds in production
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Create uploads and logs directory
RUN mkdir -p uploads logs

# Expose the port the app runs on
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]
