/** @type {import('next').NextConfig} */
const nextConfig = {
  // Live updates use Server-Sent Events; compression would hold them back.
  compress: false,
  async rewrites() {
    // Phones only talk to this Next.js server; it forwards /api to the Go server.
    const api = process.env.API_URL || "http://localhost:8080";
    return [{ source: "/api/:path*", destination: `${api}/api/:path*` }];
  },
};
export default nextConfig;
