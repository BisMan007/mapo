import axios from 'axios';
import { google } from 'googleapis';
import { config } from '../config';

// A highly reliable, public domain tech video stream hosted on Google Cloud Storage (no CORS, no expiration)
const MOCK_VEO_VIDEO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4';

function extractKeywords(prompt: string): string {
  const stopwords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'for', 'with',
    'about', 'against', 'between', 'into', 'through', 'during', 'before',
    'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out',
    'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once',
    'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both',
    'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't',
    'can', 'will', 'just', 'don', 'should', 'now', 'generate', 'image', 'creative',
    'showing', 'representing', 'ad', 'advertisement', 'for', 'called', 'with', 'picture', 'photo'
  ]);
  
  const words = prompt
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w));
    
  if (words.length === 0) return 'marketing';
  return words.slice(0, 3).join(',');
}

/**
 * Generates an image using Vertex AI Imagen 3
 */
export async function generateVertexImage(prompt: string): Promise<string> {
  const keywords = extractKeywords(prompt);
  const fallbackUrl = `https://loremflickr.com/800/800/${encodeURIComponent(keywords)}`;

  if (config.MOCK_MODE) {
    console.log(`[MOCK VERTEX IMAGEN 3] Generating image for prompt: "${prompt}"`);
    return fallbackUrl;
  }

  try {
    console.log(`[Vertex AI Imagen 3] Running query: "${prompt}".`);
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse.token;
    const projectId = process.env.GCP_PROJECT_ID || await auth.getProjectId();
    const location = process.env.GCP_LOCATION || 'us-central1';

    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate-002:predict`;
    
    const response = await axios.post(
      url,
      {
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '1:1',
          outputMimeType: 'image/jpeg'
        }
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    const prediction = response.data?.predictions?.[0];
    if (prediction?.bytesBase64Encoded) {
      return `data:${prediction.mimeType || 'image/jpeg'};base64,${prediction.bytesBase64Encoded}`;
    }

    console.warn('[Vertex AI Imagen 3] No bytes returned in prediction, using fallback.');
    return fallbackUrl;
  } catch (error: any) {
    console.error('Vertex AI Imagen 3 error, falling back:', error?.response?.data || error?.message);
    return fallbackUrl;
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
    console.log(`[Vertex AI Google Veo] Running video query: "${prompt}".`);
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse.token;
    const projectId = process.env.GCP_PROJECT_ID || await auth.getProjectId();
    const location = process.env.GCP_LOCATION || 'us-central1';

    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/veo-2.0-generate-001:predictLongRunning`;
    
    const response = await axios.post(
      url,
      {
        instances: [{ prompt }],
        parameters: {
          durationSeconds: 5,
          aspectRatio: '16:9',
          personGeneration: 'dont_allow',
          gcsDestination: {
            outputUriPrefix: `gs://${projectId}-veo-output/`
          }
        }
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    console.log('[Vertex AI Google Veo] LRO created:', response.data?.name);
    
    const operationName = response.data?.name;
    if (operationName) {
      return `https://storage.googleapis.com/${projectId}-veo-output/input_file_0.mp4`;
    }

    return MOCK_VEO_VIDEO;
  } catch (error: any) {
    console.error('Vertex AI Google Veo error, falling back:', error?.response?.data || error?.message);
    return MOCK_VEO_VIDEO;
  }
}
