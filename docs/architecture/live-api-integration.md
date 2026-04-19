# Live API Integration Notes

## O*NET
Use O*NET Web Services as the occupation and skill source of truth.
Authentication is handled with credentials and Basic auth against the official web services endpoint.

## BLS
Use the BLS Public Data API v2 as the labor signal source.
The API supports:
- POST requests for multiple series
- latest=true GET requests for recent data points

## OpenAI
Use the Responses API as the primary server-side integration.
Use built-in tools such as web search only from backend services, never directly from the browser.

Implementation note:
The starter repo now contains runnable HTTP clients and persistence wiring, but exact response-shape normalization still needs final tuning against live payloads.
