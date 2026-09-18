export type HealthResponse = {
  status: string;
  service: string;
  timestamp: string;
};

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch("/api/v1/health");
  if (!response.ok) throw new Error("API health check failed");
  return response.json() as Promise<HealthResponse>;
}
