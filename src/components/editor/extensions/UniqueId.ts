import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';

/**
 * UniqueId Extension
 * 
 * Assigns a unique UUID to every block-level node in the editor.
 * This enables:
 * - Block-level deep linking (copy link to specific block)
 * - Block-level collaboration tracking
 * - Drag-and-drop block identification
 */

export interface UniqueIdOptions {
    /**
     * The attribute name used to store the unique ID
     * @default 'blockId'
     */
    attributeName: string;

    /**
     * List of node types that should have unique IDs
     */
    types: string[];

    /**
     * Function to generate unique IDs
     * @default crypto.randomUUID()
     */
    generateID: () => string;
}

// Plugin key for state management
const uniqueIdPluginKey = new PluginKey('uniqueId');

export const UniqueId = Extension.create<UniqueIdOptions>({
    name: 'uniqueId',

    addOptions() {
        return {
            attributeName: 'blockId',
            types: [
                'paragraph',
                'heading',
                'bulletList',
                'orderedList',
                'listItem',
                'taskList',
                'taskItem',
                'codeBlock',
                'blockquote',
                'table',
                'tableRow',
                'tableCell',
                'tableHeader',
                'horizontalRule',
                'image',
                // Notion-style blocks
                'callout',
                'toggle',
                'video',
                'equation',
                'tableOfContents',
                'bookmark',
                'file',
            ],
            generateID: () => crypto.randomUUID(),
        };
    },

    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    [this.options.attributeName]: {
                        default: null,
                        parseHTML: (element) => element.getAttribute(`data-${this.options.attributeName}`),
                        renderHTML: (attributes) => {
                            if (!attributes[this.options.attributeName]) {
                                return {};
                            }
                            return {
                                [`data-${this.options.attributeName}`]: attributes[this.options.attributeName],
                            };
                        },
                    },
                },
            },
        ];
    },

    addProseMirrorPlugins() {
        const { types, attributeName, generateID } = this.options;
        const editor = this.editor;

        return [
            new Plugin({
                key: uniqueIdPluginKey,
                appendTransaction: (transactions, oldState, newState) => {
                    // Only process if document changed
                    const docChanged = transactions.some((tr) => tr.docChanged);
                    if (!docChanged) {
                        return null;
                    }

                    const tr = newState.tr;
                    let modified = false;

                    // Collect all existing IDs to ensure uniqueness
                    const existingIds = new Set<string>();
                    newState.doc.descendants((node) => {
                        const id = node.attrs[attributeName];
                        if (id) {
                            existingIds.add(id);
                        }
                    });

                    // Traverse document and add IDs where missing
                    newState.doc.descendants((node, pos) => {
                        // Check if this node type should have an ID
                        if (!types.includes(node.type.name)) {
                            return true; // Continue traversing
                        }

                        // Check if ID is missing
                        const currentId = node.attrs[attributeName];
                        if (!currentId) {
                            // Generate a unique ID
                            let newId = generateID();
                            while (existingIds.has(newId)) {
                                newId = generateID();
                            }
                            existingIds.add(newId);

                            // Set the attribute
                            tr.setNodeMarkup(pos, undefined, {
                                ...node.attrs,
                                [attributeName]: newId,
                            });
                            modified = true;
                        }

                        return true; // Continue traversing
                    });

                    return modified ? tr : null;
                },
            }),
        ];
    },
});

/**
 * Helper function to get block ID at a specific position
 */
export function getBlockIdAtPos(state: any, pos: number): string | null {
    const $pos = state.doc.resolve(pos);
    for (let depth = $pos.depth; depth >= 0; depth--) {
        const node = $pos.node(depth);
        if (node.attrs?.blockId) {
            return node.attrs.blockId;
        }
    }
    return null;
}

/**
 * Helper function to find block position by ID
 */
export function findBlockById(doc: ProseMirrorNode, blockId: string): number | null {
    let foundPos: number | null = null;
    doc.descendants((node, pos) => {
        if (node.attrs?.blockId === blockId) {
            foundPos = pos;
            return false; // Stop traversing
        }
        return true;
    });
    return foundPos;
}

export default UniqueId;
