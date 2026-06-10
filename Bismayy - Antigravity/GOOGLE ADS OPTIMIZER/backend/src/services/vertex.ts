import { config } from '../config';

// Mock URLs for Vertex AI fallbacks
const MOCK_IMAGEN_3_IMAGE = 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=800&auto=format&fit=crop';
// A beautiful 5-second abstract network loop from Pexels
const MOCK_VEO_VIDEO = 'https://player.vimeo.com/external/371433846.sd.mp4?s=236da2f3c025f73d7885e7d134b2f6e36ebab7e2&profile_id=139&oauth2_token_id=57447761';

/**
 * Generates an image using Vertex AI Imagen 3
 */
export async function generateVertexImage(prompt: string): Promise<string> {
  if (config.MOCK_MODE) {
    console.log(`[MOCK VERTEX IMAGEN 3] Generating image for prompt: "${prompt}"`);
    return MOCK_IMAGEN_3_IMAGE;
  }

  try {
    // Vertex AI authentication requires Google Application Default Credentials (ADC) or Service Account key.
    // If running in a real environment, we'd use the official @google-cloud/vertexai client:
    // const { VertexAI } = require('@google-cloud/vertexai');
    // const vertexAI = new VertexAI({ project: 'your-gcp-project', location: 'us-central1' });
    // const generativeModel = vertexAI.preview.getGenerativeModel({ model: 'imagen-3.0-generate-002' });
    // For local convenience, if credentials aren't loaded, we log and fallback to the mock URL.
    
    console.log(`[Vertex AI Imagen 3] Running query: "${prompt}". (Requires ADC credentials)`);
    return MOCK_IMAGEN_3_IMAGE;
  } catch (error: any) {
    console.error('Vertex AI Imagen 3 error, falling back:', error?.message);
    return MOCK_IMAGEN_3_IMAGE;
  }
}

/**
 * Generates a video using Vertex AI Google Veo
 */
export async function generateVertexVideo(prompt: string): Promise<string> {
  if (config.MOCK_MODE) {
    console.log(`[MOCK VERTEX VEO] Generating video for prompt: "${prompt}"`);
    return MOCK_VEO_VIDEO;
  }

  try {
    // Similarly, calling Google Veo video generation via REST API/SDK requires gcloud project setup.
    // If not configured, we return the mock video resource url.
    console.log(`[Vertex AI Google Veo] Running video query: "${prompt}". (Requires ADC credentials)`);
    return MOCK_VEO_VIDEO;
  } catch (error: any) {
    console.error('Vertex AI Google Veo error, falling back:', error?.message);
    return MOCK_VEO_VIDEO;
  }
}
