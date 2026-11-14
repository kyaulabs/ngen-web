# nginx deployment

NGEN’s website is a static site. **nginx serves the HTML, CSS, JavaScript, and assets directly. There is no Node.js production server, upstream application, PHP runtime, or database.**

This configuration serves a Git checkout at **`/nginx/git/ngen-web`**. The webserver needs Git and nginx, but **no Node.js, npm install, build step, or separate copy of the site**. `node tests/server.mjs` is only an automated test helper; do not run it in production or proxy nginx to port 4173.

## Clone the site

Run Git as your deployment account, which needs write access to `/nginx/git`. Do not use the nginx worker account for deployment:

```sh
git clone --branch main https://github.com/kyaulabs/ngen-web.git /nginx/git/ngen-web
```

The generated `theme.min.js`, `space.min.js`, and `app.min.js` files are not tracked in Git. The nginx rules below map those existing browser URLs directly to the tracked `theme.js`, `space.js`, and `app.js` files. They serve ordinary browser JavaScript, not a server-side application. Vendored D3, styles, and brand assets are already tracked.

The aliases deliberately use source files even if an old generated `.min.js` file remains in the checkout, so `git pull` cannot leave nginx serving a stale build.

nginx needs read access to the public files and traversal permission on every parent directory, including `/nginx` and `/nginx/git`. If the checkout was created with restrictive permissions, run the following as its owner, and grant parent-directory traversal through your server’s existing group/ACL policy:

```sh
cd /nginx/git/ngen-web
chmod 0755 . vendor
chmod 0644 index.html styles.css theme.js space.js app.js vendor/d3.min.js
find assets brand -type d -exec chmod 0755 {} +
find assets brand -type f -exec chmod 0644 {} +
```

Keep the checkout writable only by the deployment account. nginx does not need write access, access to Git metadata, or access to development dependencies. Do not recursively open permissions on the whole checkout.

## Configure nginx

Replace `ngen.example.com` with your hostname. Put this complete `server` block in a file included by nginx’s `http` context, using your distribution’s normal virtual-host layout. The root is `/nginx/git/ngen-web`; adjust the MIME include path if your nginx installation uses a different location. Replace any existing generic file-serving or application-proxy rules for this virtual host with the allowlist below.

This port-80 configuration is suitable for an internal nginx server behind an existing HTTPS-terminating proxy, or for an initial local check. **The public browser-facing site should use HTTPS.** For nginx-managed TLS, use the next section.

```nginx
server {
    listen 80;
    server_name ngen.example.com;

    root /nginx/git/ngen-web;
    index index.html;
    autoindex off;
    open_file_cache off;

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

    # index.html requests these URLs; serve tracked sources without a build.
    location = /theme.min.js {
        alias /nginx/git/ngen-web/theme.js;
    }

    location = /space.min.js {
        alias /nginx/git/ngen-web/space.js;
    }

    location = /app.min.js {
        alias /nginx/git/ngen-web/app.js;
    }

    location ~ ^/(?:index\.html|styles\.css|vendor/d3\.min\.js)$ {
        try_files $uri =404;
    }

    location ~ ^/(?:assets|brand)/ {
        try_files $uri =404;
    }

    # Deny every other checkout path, including Git and development tooling.
    location / {
        return 404;
    }
}
```

There is intentionally no `proxy_pass`, `fastcgi_pass`, or Node.js service. The browser calls the public GitHub API directly; nginx does not need API credentials or a telemetry proxy. The three exact script aliases are the only exceptions to the ban on application source URLs: direct requests to `/app.js`, `/space.js`, and `/theme.js` still return `404`.

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

## Update the site

Pull the deployment branch as the checkout owner:

```sh
git -C /nginx/git/ngen-web pull --ff-only
```

No build or Node.js process is needed. Keep local changes out of the deployment checkout; if a fast-forward pull fails, inspect the changes rather than discarding them. With the configuration above, ordinary file updates do not require an nginx reload. Validate and reload nginx whenever you change its configuration.

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
curl -I https://ngen.example.com/.git/HEAD
curl -I https://ngen.example.com/not-a-route
```

Expect `200` with appropriate HTML, JavaScript, CSS, and SVG content types for the first four requests, and `404` for the last four. For an internal HTTP check, use the internal address and the configured `Host` header instead.

Finally, open the HTTPS site and check the hero animation, theme toggle, source-command copy button, and dashboard. A GitHub rate limit can legitimately produce snapshot/unavailable-feed states; missing local assets or JavaScript console errors are deployment failures. No process should need to listen on port 4173 in production.

See [DEVELOPMENT.md](DEVELOPMENT.md) for build/test tooling. Set absolute Open Graph image and page URLs in `index.html` once the production origin is known.
