/**
 * Event Logs Configuration
 * 
 * This file contains all the configurable settings for event log display.
 * Users can easily modify these settings to customize how event logs are
 * fetched, filtered, and displayed.
 */

module.exports = {
  /**
   * Maximum number of recent log entries to display
   * This replaces the previous 24-hour time window approach
   */
  maxLogEntries: 8,

  /**
   * GraphQL filter string for log queries
   * Examples:
   * - "<EVENT>" - filters for event-type logs
   * - "<DEPLOY>" - filters for deployment logs  
   * - "" - no filter (all logs)
   * - "error" - filter for logs containing "error"
   */
  logFilter: "<EVENT>",

  /**
   * Display algorithm for log messages
   * 
   * Choose one approach:
   * - 'regex': Use a regex with capturing group (set displayRegex below)
   * - 'custom': Use the customDisplayFunction below
   */
  displayAlgorithm: 'regex',

  /**
   * Regex pattern with capturing group for extracting display text
   * Only used when displayAlgorithm is 'regex'
   * 
   * The first capturing group will be used as the display text.
   * If no match or no capturing group, falls back to truncated message.
   * 
   * Examples:
   * - /\[([^\]]+)\]/ - Extract text between square brackets (default)
   * - /ERROR:\s*(.+)/ - Extract everything after "ERROR: "
   * - /(\w+):/ - Extract first word before a colon
   */
  displayRegex: /\[([^\]]+)\]/,

  /**
   * Custom display function
   * Only used when displayAlgorithm is set to 'custom'
   * 
   * @param {string} message - The raw log message
   * @returns {string} - The processed message for display
   */
  customDisplayFunction: (message) => {
    // Example: Extract everything after a colon
    const colonIndex = message.indexOf(':');
    if (colonIndex !== -1 && colonIndex < message.length - 1) {
      return message.substring(colonIndex + 1).trim();
    }
    return message.substring(0, 30) + '...';
  },

  /**
   * Fallback configuration
   * Used when regex doesn't match or custom function fails
   */
  fallback: {
    maxLength: 30
  }
};