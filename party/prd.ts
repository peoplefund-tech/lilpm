/**
 * PartyKit Yjs Server for PRD Real-time Collaboration
 * 
 * This server handles real-time synchronization of PRD documents
 * using Yjs CRDT with y-partykit.
 */

import type * as Party from "partykit/server";
import { onConnect } from "y-partykit";

export default class PRDCollaborationServer implements Party.Server {
    constructor(readonly room: Party.Room) { }

    onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
        // Use y-partykit's onConnect handler for Yjs synchronization
        // This automatically handles:
        // - Document sync between clients
        // - Awareness (cursors, presence)
        // - Persistence in Durable Objects storage
        return onConnect(conn, this.room, {
            persist: true, // Persist document to Cloudflare Durable Objects
            callback: {
                // Optional: Called when document updates
                handler: async (doc) => {
                    // Document state is automatically persisted by y-partykit
                    console.log(`[PRD] Document ${this.room.id} updated`);
                },
            },
        });
    }
}
