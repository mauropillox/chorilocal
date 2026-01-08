# Use official Python image from the Docker Hub
FROM python:3.11-slim

# Security: Install security updates
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Security: Create non-root user
RUN groupadd --gid 1000 appgroup && \
    useradd --uid 1000 --gid appgroup --shell /bin/bash --create-home appuser

# Set the working directory in the container
WORKDIR /app

# Copy the requirements.txt file into the container
COPY requirements.txt /app/

# Install the dependencies including gunicorn for production
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy the rest of the application
COPY --chown=appuser:appgroup . /app/

# Create data directories with proper permissions
RUN mkdir -p /data /backups && chown -R appuser:appgroup /data /backups

# Security: Switch to non-root user
USER appuser

# Expose the port FastAPI will run on
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Production: Use gunicorn with uvicorn workers
# For development, override with: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
CMD ["gunicorn", "main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "--access-logfile", "-", "--error-logfile", "-"]
