import * as React from "react";
import { useCallback } from "react";
import { styled, Theme } from "@mui/material/styles";

import equal from "react-fast-compare"
import {
    Box,
    FormControl,
    FormHelperText,
    IconButton,
    Paper,
    Skeleton,
    Typography
} from "@mui/material";

import {
    ArrayProperty,
    FieldProps,
    Property,
    ResolvedStringProperty,
    StorageConfig,
    StringProperty
} from "../../models";
import { useDropzone } from "react-dropzone";
import ClearIcon from "@mui/icons-material/Clear";
import { PropertyPreview, PreviewSize } from "../../preview";
import { FieldDescription } from "../index";
import { LabelWithIcon } from "../components";
import { ErrorBoundary } from "../../core/internal/ErrorBoundary";

import clsx from "clsx";
import {
    useClearRestoreValue,
    useSnackbarController,
    useStorageSource
} from "../../hooks";
import { isReadOnly } from "../../core/util/entities";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import { resolveStorageString } from "../../core/util/storage";

const PREFIX = "StorageUploadField";

const classes = {
    dropZone: `${PREFIX}-dropZone`,
    disabled: `${PREFIX}-disabled`,
    nonActiveDrop: `${PREFIX}-nonActiveDrop`,
    activeDrop: `${PREFIX}-activeDrop`,
    acceptDrop: `${PREFIX}-acceptDrop`,
    rejectDrop: `${PREFIX}-rejectDrop`,
    uploadItem: `${PREFIX}-uploadItem`,
    uploadItemSmall: `${PREFIX}-uploadItemSmall`,
    thumbnailCloseIcon: `${PREFIX}-thumbnailCloseIcon`
};

const StyledBox = styled(Box)(({ theme }:
                                   {
                                       theme: Theme
                                   }
) => ({
    [`&.${classes.dropZone}`]: {
        position: "relative",
        paddingTop: "2px",
        border: "2px solid transparent",
        minHeight: "254px",
        outline: 0,
        borderTopLeftRadius: "2px",
        borderTopRightRadius: "2px",
        backgroundColor: theme.palette.mode === "light" ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.09)",
        borderBottom: theme.palette.mode === "light" ? "1px solid rgba(0, 0, 0, 0.42)" : "1px solid rgba(255, 255, 255, 0.7)",
        boxSizing: "border-box",
        transition: "border-bottom-color 200ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
        "&:focus": {
            borderBottom: `2px solid ${theme.palette.primary.main}`
        }
    },

    [`&.${classes.disabled}`]: {
        backgroundColor: "rgba(0, 0, 0, 0.12)",
        color: theme.palette.mode === "light" ? "rgba(0, 0, 0, 0.38)" : "rgba(255, 255, 255, 0.38)",
        borderBottom: `1px dotted ${theme.palette.grey[400]}`
    },

    [`&.${classes.nonActiveDrop}`]: {
        "&:hover": {
            backgroundColor: theme.palette.mode === "light" ? "rgba(0, 0, 0, 0.09)" : "rgba(255, 255, 255, 0.13)"
        }
    },

    [`&.${classes.activeDrop}`]: {
        paddingTop: "0px",
        boxSizing: "border-box",
        border: "2px solid"
    },

    [`&.${classes.acceptDrop}`]: {
        transition: "background-color 200ms cubic-bezier(0.0, 0, 0.2, 1) 0ms",
        background: "repeating-linear-gradient( 45deg, rgba(0, 0, 0, 0.09), rgba(0, 0, 0, 0.09) 10px, rgba(0, 0, 0, 0.12) 10px, rgba(0, 0, 0, 0.12) 20px) !important",
        border: "2px solid",
        borderColor: theme.palette.success.light
    },

    [`&.${classes.rejectDrop}`]: {
        border: "2px solid",
        borderColor: theme.palette.error.light
    },

    [`& .${classes.uploadItem}`]: {
        padding: theme.spacing(1),
        minWidth: 220,
        minHeight: 220
    },

    [`& .${classes.uploadItemSmall}`]: {
        padding: theme.spacing(1),
        minWidth: 118,
        minHeight: 118,
        boxSizing: "border-box"
    },

    [`& .${classes.thumbnailCloseIcon}`]: {
        position: "absolute",
        borderRadius: "9999px",
        top: -8,
        right: -8,
        zIndex: 100,
        backgroundColor: theme.palette.background.paper
    }
}));

type StorageUploadFieldProps = FieldProps<string | string[]>;

/**
 * Field that allows to upload files to Google Cloud Storage.
 *
 * This is one of the internal components that get mapped natively inside forms
 * and tables to the specified properties.
 * @category Form fields
 */
export function StorageUploadFieldBinding({
                                              propertyKey,
                                              value,
                                              setValue,
                                              error,
                                              showError,
                                              autoFocus,
                                              tableMode,
                                              property,
                                              includeDescription,
                                              context,
                                              isSubmitting
                                          }: StorageUploadFieldProps) {

    const multipleFilesSupported = property.dataType === "array";
    const disabled = isReadOnly(property) || !!property.disabled || isSubmitting;

    const internalValue = multipleFilesSupported
        ? (Array.isArray(value) ? value : [])
        : value;

    useClearRestoreValue<string | string[]>({
        property,
        value,
        setValue
    });

    const storage: StorageConfig | undefined = property.dataType === "string"
        ? property.storage
        : property.dataType === "array" &&
        (property.of as Property).dataType === "string"
            ? (property.of as StringProperty).storage
            : undefined;

    if (!storage)
        throw Error("Storage meta must be specified");

    const fileNameBuilder = (file: File) => {
        if (storage.fileName) {
            const fileName = resolveStorageString(storage.fileName,
                storage,
                context.values,
                context.entityId,
                context.path,
                property,
                file,
                propertyKey);

            if (!fileName || fileName.length === 0) {
                throw Error("You need to return a valid filename");
            }
            return fileName;
        }
        return file.name;
    };

    const storagePathBuilder = (file: File) => {
        return resolveStorageString(storage.storagePath, storage, context.values, context.entityId, context.path, property, file, propertyKey) ?? "/";
    };

    return (

            <FormControl fullWidth
                         required={property.validation?.required}
                         error={showError}>

                {!tableMode &&
                <FormHelperText filled
                                required={property.validation?.required}>
                    <LabelWithIcon property={property}/>
                </FormHelperText>}

                <StorageUpload
                    value={internalValue}
                    name={propertyKey}
                    disabled={disabled}
                    autoFocus={autoFocus}
                    property={property}
                    onChange={(newValue) => {
                        setValue(newValue);
                    }}
                    fileNameBuilder={fileNameBuilder}
                    storagePathBuilder={storagePathBuilder}
                    storage={storage}
                    multipleFilesSupported={multipleFilesSupported}/>

                {includeDescription &&
                <FieldDescription property={property as any}/>}

                {showError && <FormHelperText>{error}</FormHelperText>}

            </FormControl>
    );
}

/**
 * Internal representation of an item in the storage
 * It can have two states, having a storagePathOrDownloadUrl set,
 * which means the file has
 * been uploaded and it is rendered as a preview
 * Or have a pending file being uploaded.
 */
interface StorageFieldItem {
    id: number; // generated on the fly for internal use only
    storagePathOrDownloadUrl?: string;
    file?: File;
    fileName?: string;
    metadata?: any,
    size: PreviewSize
}

interface StorageUploadProps {
    value: string | string[];
    name: string;
    property: StringProperty | ArrayProperty<string[]>;
    onChange: (value: string | string[] | null) => void;
    multipleFilesSupported: boolean;
    autoFocus: boolean;
    disabled: boolean;
    storage: StorageConfig;
    fileNameBuilder: (file: File) => string;
    storagePathBuilder: (file: File) => string;
}

function FileDropComponent({
                               storage,
                               disabled,
                               isDraggingOver,
                               onExternalDrop,
                               multipleFilesSupported,
                               droppableProvided,
                               autoFocus,
                               internalValue,
                               property,
                               onClear,
                               metadata,
                               storagePathBuilder,
                               onFileUploadComplete,
                               size,
                               name,
                               helpText
                           }: {
    storage: StorageConfig,
    disabled: boolean,
    isDraggingOver: boolean,
    droppableProvided: any,
    onExternalDrop: (acceptedFiles: File[]) => void,
    multipleFilesSupported: boolean,
    autoFocus: boolean,
    internalValue: StorageFieldItem[],
    property: StringProperty | ArrayProperty<string[]>,
    onClear: (clearedStoragePathOrDownloadUrl: string) => void,
    metadata: any,
    storagePathBuilder: (file: File) => string,
    onFileUploadComplete: (uploadedPath: string, entry: StorageFieldItem, fileMetadata?: any) => Promise<void>,
    size: PreviewSize,
    name: string,
    helpText: string
}) {


    const {
        getRootProps,
        getInputProps,
        isDragActive,
        isDragAccept,
        isDragReject
    } = useDropzone({
            accept: storage.acceptedFiles,
            disabled: disabled || isDraggingOver,
            noDragEventsBubbling: true,
            onDrop: onExternalDrop
        }
    );

    return (
        <StyledBox
            {...getRootProps()}
            className={clsx(classes.dropZone, {
                [classes.nonActiveDrop]: !isDragActive,
                [classes.activeDrop]: isDragActive,
                [classes.rejectDrop]: isDragReject,
                [classes.acceptDrop]: isDragAccept,
                [classes.disabled]: disabled
            })}
            sx={{
                display: multipleFilesSupported && internalValue.length ? undefined : "flex",
                alignItems: "center"
            }}
        >
            <Box
                {...droppableProvided.droppableProps}
                ref={droppableProvided.innerRef}
                sx={{
                    display: "flex",
                    alignItems: "center",
                    overflow: multipleFilesSupported && internalValue.length ? "auto" : undefined,
                    minHeight: multipleFilesSupported && internalValue.length ? 180 : 250,
                    p: 1,
                    "&::-webkit-scrollbar": {
                        display: "none"
                    }
                }}
            >

                <input
                    autoFocus={autoFocus}
                    {...getInputProps()} />

                {internalValue.map((entry, index) => {
                    let child: any;
                    if (entry.storagePathOrDownloadUrl) {
                        const renderProperty = multipleFilesSupported
                            ? (property as ArrayProperty<string[]>).of as ResolvedStringProperty
                            : property as ResolvedStringProperty;
                        child = (
                            <StorageItemPreview
                                name={`storage_preview_${entry.storagePathOrDownloadUrl}`}
                                property={renderProperty}
                                disabled={disabled}
                                value={entry.storagePathOrDownloadUrl}
                                onClear={onClear}
                                size={entry.size}/>
                        );
                    } else if (entry.file) {
                        child = (
                            <StorageUploadProgress
                                entry={entry}
                                metadata={metadata}
                                storagePath={storagePathBuilder(entry.file)}
                                onFileUploadComplete={onFileUploadComplete}
                                size={size}
                            />
                        );
                    }

                    return (
                        <Draggable
                            key={`array_field_${name}_${entry.id}}`}
                            draggableId={`array_field_${name}_${entry.id}}`}
                            index={index}>
                            {(provided, snapshot) => (
                                <Box
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    style={
                                        provided.draggableProps.style
                                    }
                                    sx={{
                                        borderRadius: "4px"
                                    }}
                                >
                                    {child}
                                </Box>
                            )}
                        </Draggable>
                    );
                })
                }

                {droppableProvided.placeholder}


            </Box>

            <Box
                sx={{
                    flexGrow: 1,
                    minHeight: 38,
                    boxSizing: "border-box",
                    m: 2
                }}>
                <Typography align={"center"}
                            variant={"body2"}
                            sx={(theme) => ({
                                color: "#838383",
                                fontWeight: theme.typography.fontWeightMedium
                            })}>
                    {helpText}
                </Typography>
            </Box>

        </StyledBox>
    );
}

export function StorageUpload({
                                  property,
                                  name,
                                  value,
                                  onChange,
                                  multipleFilesSupported,
                                  disabled,
                                  autoFocus,
                                  storage,
                                  fileNameBuilder,
                                  storagePathBuilder
                              }: StorageUploadProps) {

    const storageSource = useStorageSource();

    if (multipleFilesSupported) {
        const arrayProperty = property as ArrayProperty<string[]>;
        if (arrayProperty.of) {
            if (arrayProperty.of.dataType !== "string") {
                throw Error("Storage field using array must be of data type string");
            }
        } else {
            throw Error("Storage field using array must be of data type string");
        }
    }

    const metadata: any | undefined = storage?.metadata;
    const size = multipleFilesSupported ? "small" : "regular";

    const internalInitialValue: StorageFieldItem[] =
        (multipleFilesSupported
            ? value as string[]
            : [value as string]).map(entry => (
            {
                id: getRandomId(),
                storagePathOrDownloadUrl: entry,
                metadata: metadata,
                size: size
            }
        ));

    const [initialValue, setInitialValue] = React.useState<string | string[]>(value);
    const [internalValue, setInternalValue] = React.useState<StorageFieldItem[]>(internalInitialValue);
    const [hoveredIndex, setHoveredIndex] = React.useState<number | undefined>(undefined);

    if (!equal(initialValue, value)) {
        setInitialValue(value);
        setInternalValue(internalInitialValue);
    }

    function getRandomId() {
        return Math.floor(Math.random() * Math.floor(Number.MAX_SAFE_INTEGER));
    }

    const moveItem = (fromIndex: number, toIndex: number) => {
        const newValue = [...internalValue];
        const item = newValue[fromIndex];
        newValue.splice(fromIndex, 1);
        newValue.splice(toIndex, 0, item);
        setInternalValue(newValue);
        const fieldValue = newValue
            .filter(e => !!e.storagePathOrDownloadUrl)
            .map(e => e.storagePathOrDownloadUrl as string);
        onChange(fieldValue);
    };

    const onDragEnd = (result: any) => {
        // dropped outside the list
        if (!result.destination) {
            return;
        }

        moveItem(result.source.index, result.destination.index);

    }

    function removeDuplicates(items: StorageFieldItem[]) {
        return items.filter(
            (item, i) => {
                return ((items.map((v) => v.storagePathOrDownloadUrl).indexOf(item.storagePathOrDownloadUrl) === i) || !item.storagePathOrDownloadUrl) &&
                    ((items.map((v) => v.file).indexOf(item.file) === i) || !item.file);
            }
        );
    }

    const onExternalDrop = (acceptedFiles: File[]) => {

        if (!acceptedFiles.length || disabled)
            return;

        let newInternalValue: StorageFieldItem[];
        if (multipleFilesSupported) {
            newInternalValue = [...internalValue,
                ...(acceptedFiles.map(file => ({
                    id: getRandomId(),
                    file,
                    fileName: fileNameBuilder(file),
                    metadata,
                    size: size
                } as StorageFieldItem)))];
        } else {
            newInternalValue = [{
                id: getRandomId(),
                file: acceptedFiles[0],
                fileName: fileNameBuilder(acceptedFiles[0]),
                metadata,
                size: size
            }];
        }

        // Remove either storage path or file duplicates
        newInternalValue = removeDuplicates(newInternalValue);
        setInternalValue(newInternalValue);
    };

    const onFileUploadComplete = async (uploadedPath: string,
                                        entry: StorageFieldItem,
                                        metadata?: any) => {

        console.debug("onFileUploadComplete", uploadedPath, entry);

        let uploadPathOrDownloadUrl = uploadedPath;
        if (storage.storeUrl) {
            uploadPathOrDownloadUrl = (await storageSource.getDownloadURL(uploadedPath)).url;
        }
        if (storage.postProcess) {
            uploadPathOrDownloadUrl = await storage.postProcess(uploadPathOrDownloadUrl);
        }

        let newValue: StorageFieldItem[];

        entry.storagePathOrDownloadUrl = uploadPathOrDownloadUrl;
        entry.metadata = metadata;
        newValue = [...internalValue];

        newValue = removeDuplicates(newValue);
        setInternalValue(newValue);

        const fieldValue = newValue
            .filter(e => !!e.storagePathOrDownloadUrl)
            .map(e => e.storagePathOrDownloadUrl as string);

        if (multipleFilesSupported) {
            onChange(fieldValue);
        } else {
            onChange(fieldValue ? fieldValue[0] : null);
        }
    };

    const onClear = (clearedStoragePathOrDownloadUrl: string) => {
        if (multipleFilesSupported) {
            const newValue: StorageFieldItem[] = internalValue.filter(v => v.storagePathOrDownloadUrl !== clearedStoragePathOrDownloadUrl);
            onChange(newValue.filter(v => !!v.storagePathOrDownloadUrl).map(v => v.storagePathOrDownloadUrl as string));
            setInternalValue(newValue);
        } else {
            onChange(null);
            setInternalValue([]);
        }
    };

    const helpText = multipleFilesSupported
        ? "Drag 'n' drop some files here, or click to select files"
        : "Drag 'n' drop a file here, or click to select one";

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId={`droppable_${name}`} direction="horizontal">
                {(provided, snapshot) => {
                    return <FileDropComponent storage={storage}
                                              disabled={disabled}
                                              isDraggingOver={snapshot.isDraggingOver}
                                              droppableProvided={provided}
                                              onExternalDrop={onExternalDrop}
                                              multipleFilesSupported={multipleFilesSupported}
                                              autoFocus={autoFocus}
                                              internalValue={internalValue}
                                              property={property}
                                              onClear={onClear}
                                              metadata={metadata}
                                              storagePathBuilder={storagePathBuilder}
                                              onFileUploadComplete={onFileUploadComplete}
                                              size={size}
                                              name={name}
                                              helpText={helpText}/>
                }}
            </Droppable>
        </DragDropContext>
    );

}

interface StorageUploadItemProps {
    storagePath: string;
    metadata?: any,
    entry: StorageFieldItem,
    onFileUploadComplete: (value: string,
                           entry: StorageFieldItem,
                           metadata?: any) => Promise<void>;
    size: PreviewSize;
}

export function StorageUploadProgress({
                                          storagePath,
                                          entry,
                                          metadata,
                                          onFileUploadComplete,
                                          size
                                      }: StorageUploadItemProps) {


    const storage = useStorageSource();


    const snackbarContext = useSnackbarController();

    const [error, setError] = React.useState<string>();
    const [loading, setLoading] = React.useState<boolean>(false);
    const mounted = React.useRef(false);

    const upload = useCallback((file: File, fileName?: string) => {

        setError(undefined);
        setLoading(true);

        storage.uploadFile({ file, fileName, path: storagePath, metadata })
            .then(async ({ path }) => {
                console.debug("Upload successful");
                await onFileUploadComplete(path, entry, metadata);
                if (mounted.current)
                    setLoading(false);
            })
            .catch((e) => {
                console.error("Upload error", e);
                if (mounted.current) {
                    setError(e.message);
                    setLoading(false);
                }
                snackbarContext.open({
                    type: "error",
                    title: "Error uploading file",
                    message: e.message
                });
            });
    }, [entry, metadata, onFileUploadComplete, snackbarContext, storage, storagePath]);

    React.useEffect(() => {
        mounted.current = true;
        if (entry.file)
            upload(entry.file, entry.fileName);
        return () => {
            mounted.current = false;
        };
    }, [entry.file, entry.fileName, upload]);

    return (

        <Box m={1}>
            <Paper elevation={0}
                   className={size === "regular" ? classes.uploadItem : classes.uploadItemSmall}
                   variant={"outlined"}>

                {loading && <Skeleton variant="rectangular" sx={{
                    width: "100%",
                    height: "100%"
                }}/>}

                {error && <p>Error uploading file: {error}</p>}

            </Paper>
        </Box>

    );

}

interface StorageItemPreviewProps {
    name: string;
    property: ResolvedStringProperty;
    value: string,
    onClear: (value: string) => void;
    size: PreviewSize;
    disabled: boolean;
}

export function StorageItemPreview({
                                       name,
                                       property,
                                       value,
                                       onClear,
                                       disabled,
                                       size
                                   }: StorageItemPreviewProps) {


    return (
        <Box m={1} position={"relative"}>

            <Paper
                elevation={0}
                className={size === "regular" ? classes.uploadItem : classes.uploadItemSmall}
                variant={"outlined"}>

                {!disabled &&

                <a
                    className={classes.thumbnailCloseIcon}>
                    <IconButton
                        size={"small"}
                        onClick={(event) => {
                            event.stopPropagation();
                            onClear(value);
                        }}>
                        <ClearIcon fontSize={"small"}/>
                    </IconButton>
                </a>
                }

                {value &&
                <ErrorBoundary>
                    <PropertyPreview propertyKey={name}
                                     value={value}
                                     property={property}
                                     size={size}/>
                </ErrorBoundary>
                }

            </Paper>

        </Box>
    );

}