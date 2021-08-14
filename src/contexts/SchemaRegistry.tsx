import React, { useContext, useRef } from "react";
import { EntityCollection, SchemaConfig, SchemaResolver } from "../models";
import {
    getCollectionViewFromPath,
    removeInitialAndTrailingSlashes
} from "../core/navigation";
import { getSidePanelKey } from "./utils";

const DEFAULT_SCHEMA_CONTROLLER = {
    initialised: false,
    getSchemaConfig: (collectionPath: string, entityId?: string) => undefined,
    getCollectionConfig: (collectionPath: string, entityId?: string) => {
        throw Error("Reached wrong implementation");
    },
    removeAllOverridesExcept: (keys: string[]) => {
    },
    setOverride: (
        entityPath: string,
        schemaConfig: Partial<SchemaConfig> | null
    ) => {
        throw Error("Reached wrong implementation");
    }
};

/**
 * This controller is in charge of resolving the entity schemas from a given
 * path. It takes into account the `navigation` prop set in the main level of the
 * CMSApp as well as the `schemaResolver` in case you want to override schemas
 * to specific entities.
 */
export type SchemasRegistryController = {

    /**
     * Is the registry ready to be used
     */
    initialised: boolean;
    /**
     * Get props for path
     */
    getSchemaConfig: (collectionPath: string, entityId?: string) => SchemaConfig | undefined;

    /**
     * Get props for path
     */
    getCollectionConfig: (collectionPath: string, entityId?: string) => EntityCollection | undefined;

    /**
     * Set props for path
     * @return used key
     */
    setOverride: (
        entityPath: string,
        schemaConfig: Partial<SchemaConfig> | null,
        overrideSchemaResolver?: boolean
    ) => string | undefined;

    /**
     * Remove all keys not used
     * @param used keys
     */
    removeAllOverridesExcept: (
        keys: string[]
    ) => void;
};

export const SchemaRegistryContext = React.createContext<SchemasRegistryController>(DEFAULT_SCHEMA_CONTROLLER);
export const useSchemasRegistry = () => useContext(SchemaRegistryContext);

interface ViewRegistryProviderProps {
    children: React.ReactNode;
    collections?: EntityCollection[];
    schemaResolver?: SchemaResolver;
}

export const SchemaRegistryProvider: React.FC<ViewRegistryProviderProps> = ({
                                                                                children,
                                                                                collections,
                                                                                schemaResolver
                                                                            }) => {

    console.log("INIT SchemaRegistryProvider", collections);
    const initialised = collections !== undefined;
    const viewsRef = useRef<Record<string, Partial<SchemaConfig & { overrideSchemaResolver?: boolean }>>>({});

    const getSchemaConfig = (collectionPath: string, entityId?: string): SchemaConfig => {

        const sidePanelKey = getSidePanelKey(collectionPath, entityId);

        let result: Partial<SchemaConfig> = {};
        const overriddenProps = viewsRef.current[sidePanelKey];
        const resolvedProps: SchemaConfig | undefined = schemaResolver && schemaResolver({
            entityId,
            collectionPath: removeInitialAndTrailingSlashes(collectionPath)
        });

        if (resolvedProps)
            result = resolvedProps;

        if (overriddenProps) {
            // override schema resolver default to true
            const shouldOverrideResolver = overriddenProps.overrideSchemaResolver === undefined || overriddenProps.overrideSchemaResolver;
            if (shouldOverrideResolver)
                result = {
                    ...overriddenProps,
                    permissions: result.permissions || overriddenProps.permissions,
                    schema: result.schema || overriddenProps.schema,
                    subcollections: result.subcollections || overriddenProps.subcollections
                };
            else
                result = {
                    ...result,
                    permissions: overriddenProps.permissions ?? result.permissions,
                    schema: overriddenProps.schema ?? result.schema,
                    subcollections: overriddenProps.subcollections ?? result.subcollections
                };

        }

        const entityCollection: EntityCollection | undefined = getCollectionViewFromPath(collectionPath, collections);
        if (entityCollection) {
            const schema = entityCollection.schema;
            const subcollections = entityCollection.subcollections;
            const permissions = entityCollection.permissions;
            result = {
                ...result,
                schema: result.schema ?? schema,
                subcollections: result.subcollections ?? subcollections,
                permissions: result.permissions ?? permissions
            };
        }

        if (!result.schema)
            throw Error(`Not able to resolve schema for ${sidePanelKey}`);

        return result as SchemaConfig;

    };

    const getCollectionConfig = (collectionPath: string, entityId?: string) => {
        return getCollectionViewFromPath(collectionPath, collections);
    };

    const setOverride = (
        entityPath: string,
        schemaConfig: Partial<SchemaConfig> | null,
        overrideSchemaResolver?: boolean
    ) => {
        if (!schemaConfig) {
            delete viewsRef.current[entityPath];
            return undefined;
        } else {
            viewsRef.current[entityPath] = {
                ...schemaConfig,
                overrideSchemaResolver
            };
            return entityPath;
        }
    };

    const removeAllOverridesExcept = (
        keys: string[]
    ) => {
        Object.keys(viewsRef.current).forEach((currentKey) => {
            if (!keys.includes(currentKey))
                delete viewsRef.current[currentKey];
        });
    };

    return (
        <SchemaRegistryContext.Provider
            value={{
                initialised,
                getSchemaConfig,
                getCollectionConfig,
                setOverride,
                removeAllOverridesExcept
            }}
        >
            {children}
        </SchemaRegistryContext.Provider>
    );
};


