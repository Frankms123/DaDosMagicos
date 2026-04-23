# Use the official Node.js 18 image as a base
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 3002

# Define environment variables
ENV PORT=3002
ENV NODE_ENV=production

# Start the application
CMD ["node", "src/index.js"]
