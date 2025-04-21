FROM registry:2

COPY htpasswd /auth/htpasswd

ENV REGISTRY_AUTH=htpasswd \
    REGISTRY_AUTH_HTPASSWD_REALM="Registry Realm" \
    REGISTRY_AUTH_HTPASSWD_PATH=/auth/htpasswd
