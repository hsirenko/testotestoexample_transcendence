// Centralized authentication utilities

/**
 * Get authorization header for API requests
 * @param includeContentType Whether to include Content-Type: application/json header
 * @returns Headers object with authorization and optionally content-type
 */
export function getAuthHeader(includeContentType: boolean = false): HeadersInit {
    const token = localStorage.getItem('token');
    
    if (!includeContentType) {
        return token ? { Authorization: `Bearer ${token}` } : {};
    }
    
    return {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
    };
}