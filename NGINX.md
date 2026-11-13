# nginx deployment

NGEN’s website is a static site. **nginx serves the HTML, CSS, JavaScript, and assets directly. There is no Node.js production server, upstream application, PHP runtime, or database.**

Node.js/npm are only needed on a development or build machine. `node tests/server.mjs` is a loopback preview/test helper; do not run it as a production service or proxy nginx to port 4173.

## Prepare the files

Use the deployment archive attached to a [website release](https://github.com/kyaulabs/ngen-web/releases). Download the archive and `SHA256SUMS.txt`, then verify and extract them. For `v0.1.0`:

```sh
sha256sum -c SHA256SUMS.txt
tar -xzf ngen-web-v0.1.0.tar.gz
cd ngen-web-v0.1.0
```

The deployment archive already contains built scripts. GitHub’s automatic **source-code** archives do not; if building from a source checkout, run this on the build machine first:

```sh
npm ci
npm run build
```

Copy only the public site files to a dedicated document root. The following Linux example uses `/srv/www/ngen`; adjust the path for your server. Run it from the extracted deployment directory or the built source checkout:

```sh
sudo install -d -m 0755 /srv/www/ngen/vendor
sudo install -m 0644 styles.css theme.min.js space.min.js app.min.js /srv/www/ngen/
sudo install -m 0644 vendor/d3.min.js /srv/www/ngen/vendor/
sudo cp -R assets brand /srv/www/ngen/
sudo find /srv/www/ngen/assets /srv/www/ngen/brand -type d -exec chmod 0755 {} +
sudo find /srv/www/ngen/assets /srv/www/ngen/brand -type f -exec chmod 0644 {} +
sudo install -m 0644 index.html /srv/www/ngen/
```

nginx only needs read access. Do not make its worker account the writable owner of the site, and do not use the Git checkout or `node_modules/` as the document root. Deploy a complete build together; copy `index.html` last when updating files in place.

## Configure nginx

Replace `ngen.example.com` and `/srv/www/ngen` below. Put this `server` block in a file included by nginx’s `http` context, using your distribution’s normal virtual-host layout. Adjust the MIME include path if your nginx installation uses a different location.

This port-80 configuration is suitable for an internal nginx server behind an existing HTTPS-terminating proxy, or for an initial local check. **The public browser-facing site should use HTTPS.** For nginx-managed TLS, use the next section.

```nginx
server {
    listen 80;
    server_name ngen.example.com;

    root /srv/www/ngen;
    index index.html;
    autoindex off;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    add_header X-Content-Type-Options "nosniff" always;
    add_header Cache-Control "no-cache" always;

    # Deny hidden paths, including within otherwise public directories.
    location ~ (^|/)\. {
        return 404;
    }

    location = / {
        try_files /index.html =404;
    }

    location ~ ^/(?:index\.html|styles\.css|(?:theme|space|app)\.min\.js|vendor/d3\.min\.js)$ {
        try_files $uri =404;
    }

    location ~ ^/(?:assets|brand)/ {
        try_files $uri =404;
    }

    # Do not expose source scripts, package files, tests, or repository tooling.
    location / {
        return 404;
    }
}
```

There is intentionally no `proxy_pass`, `fastcgi_pass`, or Node.js service. The browser calls the public GitHub API directly; nginx does not need API credentials or a telemetry proxy.

Keep MIME mappings enabled: JavaScript, CSS, and SVG must have the correct content types, especially with `nosniff`. The application uses section anchors such as `#vitals`, not server-side routes. Missing assets and unknown paths must return `404`, not a fallback copy of `index.html`.

The asset names are not content-hashed. `Cache-Control: no-cache` permits storage but requires revalidation, preventing stale scripts after updates. Do not mark these URLs `immutable` unless you introduce versioned asset URLs.

## HTTPS

If another trusted proxy terminates TLS, keep the internal static-file server above and expose it only through that proxy. Its browser-facing URL must still be HTTPS. Do not add an internal HTTP-to-HTTPS redirect that creates a loop with your TLS terminator.

If this nginx instance terminates TLS, replace `listen 80;` in the static-file block with the following directives, using your existing certificate and key paths:

```nginx
listen 443 ssl;
ssl_certificate /path/to/site-fullchain.pem;
ssl_certificate_key /path/to/site-privkey.pem;
ssl_protocols TLSv1.2 TLSv1.3;
```

Then add a separate HTTP redirect block:

```nginx
server {
    listen 80;
    server_name ngen.example.com;
    return 308 https://ngen.example.com$request_uri;
}
```

Certificate issuance/renewal and any ACME challenge location belong to your existing TLS setup. HTTPS also enables the browser’s modern Clipboard API for the source-clone copy button.

## Validate and reload

Check the configuration before reloading nginx. These commands assume a Linux systemd installation; use your platform’s service manager otherwise:

```sh
sudo nginx -t && sudo systemctl reload nginx
```

Check the public HTTPS endpoint after deployment:

```sh
curl -I https://ngen.example.com/
curl -I https://ngen.example.com/app.min.js
curl -I https://ngen.example.com/brand/web/ngen-theme.css
curl -I https://ngen.example.com/assets/ngen-orbital-core.svg
curl -I https://ngen.example.com/app.js
curl -I https://ngen.example.com/package.json
curl -I https://ngen.example.com/not-a-route
```

Expect `200` with appropriate HTML, JavaScript, CSS, and SVG content types for the first four requests, and `404` for the last three. For an internal HTTP check, use the internal address and the configured `Host` header instead.

Finally, open the HTTPS site and check the hero animation, theme toggle, source-command copy button, and dashboard. A GitHub rate limit can legitimately produce snapshot/unavailable-feed states; missing local assets or JavaScript console errors are deployment failures. No process should need to listen on port 4173 in production.

See [DEVELOPMENT.md](DEVELOPMENT.md) for build/test tooling. Set absolute Open Graph image and page URLs in `index.html` once the production origin is known.
