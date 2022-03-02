import React from "react";

import { styled } from "@mui/material/styles";

import { Divider, Theme } from "@mui/material";
import {
    PropertyPreview,
    PropertyPreviewProps,
    PreviewSize
} from "../internal";
import { ErrorBoundary } from "../../core/internal/ErrorBoundary";
import { ResolvedProperty } from "../../models";

const PREFIX = "ArrayOneOfPreview";

const classes = {
    array: `${PREFIX}-array`,
    arrayWrap: `${PREFIX}-arrayWrap`,
    arrayItemBig: `${PREFIX}-arrayItemBig`
};

const Root = styled("div")((
   { theme } : {
        theme: Theme
    }
) => ({
    [`&.${classes.array}`]: {
        display: "flex",
        flexDirection: "column"
    },

    [`& .${classes.arrayWrap}`]: {
        display: "flex",
        flexWrap: "wrap"
    },

    [`& .${classes.arrayItemBig}`]: {
        margin: theme.spacing(1)
    }
}));

/**
 * @category Preview components
 */
export function ArrayOneOfPreview({
                                      propertyKey,
                                      value,
                                      property,
                                      size
                                  }: PropertyPreviewProps<any[]>) {

    if (property.dataType !== "array")
        throw Error("Picked wrong preview component ArrayPreview");

    if (!property.oneOf) {
        throw Error(`You need to specify an 'of' or 'oneOf' prop (or specify a custom field) in your array property ${propertyKey}`);
    }

    const values = value;

    if (!values) return null;

    const childSize: PreviewSize = size === "regular" ? "small" : "tiny";

    const typeField = property.oneOf.typeField ?? "type";
    const valueField = property.oneOf.valueField ?? "value";
    const properties = property.oneOf.properties;

    return (
        <Root className={classes.array}>
            {values &&
            values.map((value, index) =>
                <React.Fragment key={"preview_array_" + value + "_" + index}>
                    <div className={classes.arrayItemBig}>
                        <ErrorBoundary>
                            {value && <PropertyPreview
                                propertyKey={propertyKey}
                                value={value[valueField]}
                                property={properties[value[typeField]] as ResolvedProperty<any>}
                                size={childSize}/>}
                        </ErrorBoundary>
                    </div>
                    {index < values.length - 1 && <Divider/>}
                </React.Fragment>
            )}
        </Root>
    );
}