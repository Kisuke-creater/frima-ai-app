import OpenAI, { APIError } from "openai";

const DEFAULT_SERVER_LABEL = "price-research";
const DEFAULT_SERVER_DESCRIPTION =
  "Read-only market and pricing tools for secondhand listing recommendations.";

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function parseCsvEnv(name: string): string[] | undefined {
  const raw = readEnv(name);
  if (!raw) return undefined;

  const values = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return values.length > 0 ? values : undefined;
}

function parseHeadersEnv(name: string): Record<string, string> | undefined {
  const raw = readEnv(name);
  if (!raw) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${name} must be a valid JSON object.`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${name} must be a JSON object with string values.`);
  }

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`${name} must contain only non-empty string values.`);
    }
    headers[key] = value;
  }

  return Object.keys(headers).length > 0 ? headers : undefined;
}

export function buildPriceRecommendationMcpTool(): OpenAI.Responses.Tool.Mcp | null {
  const serverUrl = readEnv("OPENAI_PRICE_MCP_SERVER_URL");
  if (!serverUrl) {
    return null;
  }

  const allowedTools = parseCsvEnv("OPENAI_PRICE_MCP_ALLOWED_TOOLS");

  return {
    type: "mcp",
    server_label: readEnv("OPENAI_PRICE_MCP_SERVER_LABEL") ?? DEFAULT_SERVER_LABEL,
    server_description:
      readEnv("OPENAI_PRICE_MCP_SERVER_DESCRIPTION") ?? DEFAULT_SERVER_DESCRIPTION,
    server_url: serverUrl,
    authorization: readEnv("OPENAI_PRICE_MCP_AUTHORIZATION"),
    headers: parseHeadersEnv("OPENAI_PRICE_MCP_HEADERS_JSON"),
    allowed_tools: allowedTools ?? { read_only: true },
    require_approval: "never",
  };
}

function isPriceMcpDependencyError(error: unknown, serverLabel: string): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const normalizedServerLabel = serverLabel.toLowerCase();

  if (error instanceof APIError && error.status === 424) {
    return message.includes("mcp") || message.includes(normalizedServerLabel);
  }

  return (
    message.includes("retrieving tool list from mcp server") &&
    message.includes(normalizedServerLabel)
  );
}

export async function createResponseWithPriceMcpFallback(
  openai: OpenAI,
  params: OpenAI.Responses.ResponseCreateParamsNonStreaming,
): Promise<OpenAI.Responses.Response> {
  const priceRecommendationMcpTool = buildPriceRecommendationMcpTool();
  if (!priceRecommendationMcpTool) {
    return openai.responses.create(params);
  }

  const toolsWithMcp = params.tools
    ? [...params.tools, priceRecommendationMcpTool]
    : [priceRecommendationMcpTool];

  try {
    return await openai.responses.create({
      ...params,
      tools: toolsWithMcp,
    });
  } catch (error) {
    if (!isPriceMcpDependencyError(error, priceRecommendationMcpTool.server_label)) {
      throw error;
    }

    console.warn(
      `[price-mcp] Falling back to model-only estimation because MCP server "${priceRecommendationMcpTool.server_label}" is unavailable: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );

    return openai.responses.create({
      ...params,
      tools: params.tools,
    });
  }
}
