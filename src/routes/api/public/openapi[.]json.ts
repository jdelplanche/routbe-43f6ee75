import { createFileRoute } from "@tanstack/react-router";

/** Machine-readable contract for the public ROUT API. */
export const Route = createFileRoute("/api/public/openapi.json")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const base = new URL(request.url).origin;

        const trackedQrSchema = {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            slug: { type: "string", example: "aZ3kQ1" },
            dashboard_token: { type: "string" },
            target_type: { type: "string", example: "url" },
            target_url: { type: "string", format: "uri" },
            label: { type: "string", nullable: true },
            custom_domain: { type: "string", nullable: true },
            created_at: { type: "string", format: "date-time" },
            redirect_url: { type: "string", format: "uri" },
          },
        };

        const spec = {
          openapi: "3.1.0",
          info: {
            title: "ROUT public API",
            version: "1.0.0",
            description:
              "Create dynamic QR codes, repoint them and read scan analytics. Authenticate with a bearer API key created in the ROUT developer hub.",
          },
          servers: [{ url: base }],
          components: {
            securitySchemes: {
              bearerAuth: { type: "http", scheme: "bearer" },
            },
          },
          paths: {
            "/api/public/qr/create": {
              post: {
                summary: "Create a dynamic QR code and short link",
                description:
                  "Creates a trackable short link. Optionally attaches a verified custom domain when a bearer token identifies the owning user.",
                security: [{ bearerAuth: [] }],
                requestBody: {
                  required: true,
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        required: ["target_type", "target_url"],
                        properties: {
                          target_type: { type: "string", example: "url" },
                          target_url: { type: "string", format: "uri" },
                          label: { type: "string" },
                          custom_domain: { type: "string" },
                        },
                      },
                      example: {
                        target_type: "url",
                        target_url: "https://example.com/menu",
                        label: "Front door table tent",
                      },
                    },
                  },
                },
                responses: {
                  "200": {
                    description: "Created short link and dashboard token",
                    content: {
                      "application/json": {
                        schema: trackedQrSchema,
                        example: {
                          id: "b6e2b6b0-0000-0000-0000-000000000000",
                          slug: "aZ3kQ1",
                          dashboard_token: "5f2c9a1e8d7b4c6a3f0e9d1b",
                          target_type: "url",
                          target_url: "https://example.com/menu",
                          label: "Front door table tent",
                          custom_domain: null,
                          created_at: "2024-05-01T12:00:00.000Z",
                          redirect_url: `${base}/api/public/r/aZ3kQ1`,
                        },
                      },
                    },
                  },
                  "400": { description: "Invalid payload" },
                },
              },
            },
            "/api/public/qr/manage": {
              post: {
                summary: "Update, pause or repoint an existing dynamic QR code",
                description:
                  "Applies one action per call — regenerate_slug, set_active, set_target or set_expiry — authenticated by the dashboard token issued at creation time.",
                security: [{ bearerAuth: [] }],
                requestBody: {
                  required: true,
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        required: ["dashboard_token", "action"],
                        properties: {
                          dashboard_token: { type: "string" },
                          action: {
                            type: "string",
                            enum: ["regenerate_slug", "set_active", "set_target", "set_expiry"],
                          },
                          is_active: { type: "boolean" },
                          target_url: { type: "string", format: "uri" },
                          expires_at: { type: "string", format: "date-time", nullable: true },
                        },
                      },
                      example: {
                        dashboard_token: "5f2c9a1e8d7b4c6a3f0e9d1b",
                        action: "set_target",
                        target_url: "https://example.com/new-menu",
                      },
                    },
                  },
                },
                responses: {
                  "200": {
                    description: "Updated tracked QR",
                    content: {
                      "application/json": {
                        schema: {
                          allOf: [
                            trackedQrSchema,
                            {
                              type: "object",
                              properties: {
                                is_active: { type: "boolean" },
                                expires_at: { type: "string", format: "date-time", nullable: true },
                              },
                            },
                          ],
                        },
                        example: {
                          id: "b6e2b6b0-0000-0000-0000-000000000000",
                          slug: "aZ3kQ1",
                          dashboard_token: "5f2c9a1e8d7b4c6a3f0e9d1b",
                          target_type: "url",
                          target_url: "https://example.com/new-menu",
                          label: "Front door table tent",
                          created_at: "2024-05-01T12:00:00.000Z",
                          is_active: true,
                          expires_at: null,
                          redirect_url: `${base}/api/public/r/aZ3kQ1`,
                        },
                      },
                    },
                  },
                  "404": { description: "Not found" },
                },
              },
            },
            "/api/public/qr/stats": {
              get: {
                summary: "Scan analytics for a dynamic QR code",
                description:
                  "Returns scan history and totals for a code. Pass ?format=csv to receive a CSV export instead of JSON.",
                parameters: [
                  { name: "token", in: "query", required: true, schema: { type: "string" } },
                  {
                    name: "format",
                    in: "query",
                    required: false,
                    schema: { type: "string", enum: ["json", "csv"] },
                  },
                ],
                responses: {
                  "200": {
                    description: "Analytics payload",
                    content: {
                      "application/json": {
                        schema: {
                          type: "object",
                          properties: {
                            tracked: {
                              allOf: [
                                trackedQrSchema,
                                {
                                  type: "object",
                                  properties: {
                                    is_active: { type: "boolean" },
                                    expires_at: {
                                      type: "string",
                                      format: "date-time",
                                      nullable: true,
                                    },
                                  },
                                },
                              ],
                            },
                            scans: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  scanned_at: { type: "string", format: "date-time" },
                                  country: { type: "string", nullable: true },
                                  device: { type: "string", nullable: true },
                                  browser: { type: "string", nullable: true },
                                  os: { type: "string", nullable: true },
                                },
                              },
                            },
                            total: { type: "integer" },
                          },
                        },
                        example: {
                          tracked: {
                            id: "b6e2b6b0-0000-0000-0000-000000000000",
                            slug: "aZ3kQ1",
                            target_type: "url",
                            target_url: "https://example.com/menu",
                            label: "Front door table tent",
                            created_at: "2024-05-01T12:00:00.000Z",
                            is_active: true,
                            expires_at: null,
                            redirect_url: `${base}/api/public/r/aZ3kQ1`,
                          },
                          scans: [
                            {
                              scanned_at: "2024-05-02T09:14:22.000Z",
                              country: "US",
                              device: "mobile",
                              browser: "Safari",
                              os: "iOS",
                            },
                          ],
                          total: 1,
                        },
                      },
                    },
                  },
                  "404": { description: "Not found" },
                },
              },
            },
            "/api/public/qr/check": {
              get: {
                summary: "Check whether a dynamic QR code is live",
                description:
                  "A lightweight status probe for a short link — active state and expiry — without exposing scan history.",
                parameters: [
                  { name: "token", in: "query", required: true, schema: { type: "string" } },
                ],
                responses: {
                  "200": {
                    description: "Current status of the short link",
                    content: {
                      "application/json": {
                        schema: {
                          type: "object",
                          properties: {
                            slug: { type: "string" },
                            is_active: { type: "boolean" },
                            expires_at: { type: "string", format: "date-time", nullable: true },
                            redirect_url: { type: "string", format: "uri" },
                          },
                        },
                        example: {
                          slug: "aZ3kQ1",
                          is_active: true,
                          expires_at: null,
                          redirect_url: `${base}/api/public/r/aZ3kQ1`,
                        },
                      },
                    },
                  },
                  "404": { description: "Not found" },
                },
              },
            },
            "/api/public/domains": {
              get: {
                summary: "List custom domains connected to your account",
                description:
                  "Returns the branded domains attached to the authenticated user, their DNS verification status and which one is the default used for new dynamic QRs.",
                security: [{ bearerAuth: [] }],
                responses: {
                  "200": {
                    description: "Connected domains",
                    content: {
                      "application/json": {
                        schema: {
                          type: "object",
                          properties: {
                            domains: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  id: { type: "string", format: "uuid" },
                                  domain: { type: "string" },
                                  status: {
                                    type: "string",
                                    enum: ["pending", "pointing", "verified"],
                                  },
                                  is_default: { type: "boolean" },
                                  verified_at: {
                                    type: "string",
                                    format: "date-time",
                                    nullable: true,
                                  },
                                },
                              },
                            },
                          },
                        },
                        example: {
                          domains: [
                            {
                              id: "3a1e9c40-0000-0000-0000-000000000000",
                              domain: "links.yourbrand.com",
                              status: "verified",
                              is_default: true,
                              verified_at: "2024-04-20T08:00:00.000Z",
                            },
                          ],
                        },
                      },
                    },
                  },
                  "401": { description: "Missing or invalid bearer token" },
                },
              },
            },
            "/api/public/health": {
              get: {
                summary: "Service health probe",
                description:
                  "Reports overall API status, database connectivity and current latency.",
                responses: {
                  "200": {
                    description: "Status, database state and latency",
                    content: {
                      "application/json": {
                        schema: {
                          type: "object",
                          properties: {
                            status: { type: "string", enum: ["operational", "degraded"] },
                            database: { type: "string", enum: ["ok", "degraded"] },
                            latency_ms: { type: "integer" },
                            checked_at: { type: "string", format: "date-time" },
                          },
                        },
                        example: {
                          status: "operational",
                          database: "ok",
                          latency_ms: 42,
                          checked_at: "2024-05-02T09:15:00.000Z",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        };

        return new Response(JSON.stringify(spec, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
        });
      },
    },
  },
});
