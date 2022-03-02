import React from "react";

import { styled } from "@mui/material/styles";

import {
    PropertyPreview,
    PropertyPreviewProps,
    PreviewSize
} from "../internal";
import { ErrorBoundary } from "../../core/internal/ErrorBoundary";
import { ResolvedProperty } from "../../models";

import { Theme } from "@mui/material";

const PREFIX = "ArrayOfStorageComponentsPreview";

const classes = {
    arrayWrap: `${PREFIX}-arrayWrap`,
    arrayItem: `${PREFIX}-arrayItem`
};

const Root = styled("div")((
   { theme } : {
        theme: Theme
    }
) => ({
    [`&.${classes.arrayWrap}`]: {
        display: "flex",
        flexWrap: "wrap"
    },

    [`& .${classes.arrayItem}`]: {
        margin: theme.spacing(0.5)
    }
}));

/**
 * @category Preview components
 */
export function ArrayOfStorageComponentsPreview({
                                                    propertyKey,
                                                    value,
                                                    property,
                                                    size
                                                }: PropertyPreviewProps<any[]>) {

    if (property.dataType !== "array" || !property.of || property.of.dataType !== "string")
        throw Error("Picked wrong preview component ArrayOfStorageComponentsPreview");

    const childSize: PreviewSize = size === "regular" ? "small" : "tiny";

    return (
        <Root className={classes.arrayWrap}>
            {value &&
            value.map((v, index) =>
                <div className={classes.arrayItem}
                     key={`preview_array_storage_${propertyKey}_${index}`}>
                    <ErrorBoundary>
                        <PropertyPreview
                            propertyKey={propertyKey}
                            value={v}
                            property={property.of as ResolvedProperty<string>}
                            size={childSize}/>
                    </ErrorBoundary>
                </div>
            )}
        </Root>
    );
}