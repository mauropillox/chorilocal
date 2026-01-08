# Production Deployment Checklist

## Critical Environment Variables (Required)

### Database Configuration
- `DATABASE_URL`: PostgreSQL connection string (postgres://user:pass@host:port/dbname)
- `USE_POSTGRES`: Set to "true"

### Security
- `SECRET_KEY`: Strong JWT signing key (minimum 32 characters, use cryptographically secure random string)
- `ENVIRONMENT`: Set to "production"

### Optional Configuration
- `PG_POOL_MIN_CONN`: Minimum connection pool size (default: 2)
- `PG_POOL_MAX_CONN`: Maximum connection pool size (default: 20)
- `ACCESS_TOKEN_EXPIRE_MINUTES`: JWT token expiration (default: 30)
- `LOG_LEVEL`: Logging level (default: INFO)
- `CORS_ORIGINS`: Comma-separated list of allowed origins
- `SENTRY_DSN`: Error tracking (optional but recommended)

### Rate Limiting (Optional)
- `RATE_LIMIT_LOGIN`: Login attempts (default: 5/minute)
- `RATE_LIMIT_AUTH`: Authentication (default: 5/minute) 
- `RATE_LIMIT_READ`: Read operations (default: 100/minute)
- `RATE_LIMIT_WRITE`: Write operations (default: 30/minute)

## Production Security Features

### Automatic Validations
✅ PostgreSQL requirement enforced
✅ Weak secret key detection
✅ Database URL format validation
✅ Connection pool settings validation

### Security Headers
✅ HSTS (HTTP Strict Transport Security)
✅ X-Content-Type-Options: nosniff
✅ X-Frame-Options: DENY
✅ X-XSS-Protection
✅ Referrer-Policy
✅ Permissions-Policy
✅ Server header removal

### API Security
✅ Swagger/OpenAPI docs disabled in production
✅ Rate limiting on all endpoints
✅ JWT token expiration
✅ Password strength validation
✅ Request ID tracking
✅ Structured logging

### Container Security
✅ Non-root user (appuser)
✅ Gunicorn with 4 workers
✅ Health checks
✅ Resource limits
✅ Docker secrets support

## Pre-Deployment Steps

1. **Generate Strong Secrets**
   ```bash
   # Generate a secure SECRET_KEY
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

2. **Set Environment Variables**
   - In Render: Go to Environment tab and set all required variables
   - For Docker: Use docker-compose.prod.yml with secrets
   - For Kubernetes: Use configmaps and secrets

3. **Database Setup**
   - Ensure PostgreSQL is accessible from your deployment environment
   - Run database migrations if needed
   - Verify connection pool settings for your expected load

4. **Test Production Build**
   ```bash
   # Test with production requirements
   pip install -r requirements-prod.txt
   ENVIRONMENT=production python -c "from main import app; print('✅ Production validation passed')"
   ```

## Monitoring & Maintenance

- **Structured Logs**: All requests logged with timing and request IDs
- **Health Endpoint**: `/health` for load balancer checks
- **Error Tracking**: Sentry integration for production error monitoring
- **Performance**: Request duration logging (warnings for >500ms requests)

## Security Considerations

❌ **Never commit these to git:**
- SECRET_KEY values
- DATABASE_URL with passwords
- Production configuration files with secrets

✅ **Production hardening:**
- Use strong, unique SECRET_KEY
- Enable PostgreSQL SSL in production
- Regularly rotate secrets
- Monitor rate limit violations
- Review access logs regularly