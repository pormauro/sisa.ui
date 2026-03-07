import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ImageZoom } from "@likashefqet/react-native-image-zoom";
import { useVideoPlayer, VideoView } from "expo-video";
import { ThemedText } from "./ThemedText";
import { FileRecord } from "@/contexts/FilesContext";

const { width, height } = Dimensions.get("window");

type MediaFile = FileRecord & {
  mediaType: "image" | "video";
};

type Props = {
  visible: boolean;
  files: FileRecord[];
  initialIndex: number;
  onClose: () => void;
};

const getMime = (file: FileRecord) =>
  String(file.mimeType || file.mime || file.file_type || "").toLowerCase();

const isImage = (file: FileRecord) => getMime(file).includes("image");
const isVideo = (file: FileRecord) => getMime(file).includes("video");

const MediaViewer: React.FC<Props> = ({
  visible,
  files,
  initialIndex,
  onClose,
}) => {
  const mediaFiles: MediaFile[] = useMemo(
    () =>
      files
        .filter(f => (isImage(f) || isVideo(f)) && f.downloaded === 1 && f.localUri)
        .map(f => ({
          ...f,
          mediaType: isImage(f) ? "image" : "video",
        })),
    [files]
  );

  const [index, setIndex] = useState(initialIndex);

  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!visible) return;
    setIndex(initialIndex);

    setTimeout(() => {
      flatRef.current?.scrollToIndex({ index: initialIndex, animated: false });
    }, 50);
  }, [visible, initialIndex]);

  const current = mediaFiles[index];

  const renderItem = ({ item }: { item: MediaFile }) => {
    if (item.mediaType === "image") {
      return (
        <View style={styles.slide}>
          <ImageZoom
            uri={item.localUri!}
            minScale={1}
            maxScale={5}
            doubleTapScale={3}
            style={styles.image}
            resizeMode="contain"
          />
        </View>
      );
    }

    const player = useVideoPlayer(
      { uri: item.localUri! },
      player => {
        player.loop = false;
      }
    );

    return (
      <View style={styles.slide}>
        <VideoView
          player={player}
          style={styles.video}
          nativeControls
          contentFit="contain"
        />
      </View>
    );
  };

  const onScrollEnd = (e: any) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(newIndex);
  };

  if (!visible || mediaFiles.length === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="close" size={30} color="#fff" />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: "center" }}>
            <ThemedText style={styles.title}>
              {current?.name ?? "Archivo"}
            </ThemedText>

            <ThemedText style={styles.counter}>
              {index + 1} / {mediaFiles.length}
            </ThemedText>
          </View>

          <View style={{ width: 30 }} />
        </View>

        {/* MEDIA CAROUSEL */}
        <FlatList
          ref={flatRef}
          data={mediaFiles}
          horizontal
          pagingEnabled
          keyExtractor={i => i.id.toString()}
          renderItem={renderItem}
          onMomentumScrollEnd={onScrollEnd}
          showsHorizontalScrollIndicator={false}
        />

        {/* THUMBNAILS */}
        <View style={styles.thumbBar}>
          <FlatList
            horizontal
            data={mediaFiles}
            keyExtractor={i => "thumb" + i.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item, index: i }) => (
              <TouchableOpacity
                onPress={() =>
                  flatRef.current?.scrollToIndex({ index: i, animated: true })
                }
                style={[
                  styles.thumbWrapper,
                  i === index && styles.thumbActive,
                ]}
              >
                {item.mediaType === "image" ? (
                  <Image source={{ uri: item.localUri! }} style={styles.thumb} />
                ) : (
                  <View style={styles.videoThumb}>
                    <MaterialIcons
                      name="play-circle-outline"
                      size={26}
                      color="#fff"
                    />
                  </View>
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 50,
    paddingHorizontal: 16,
  },

  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  counter: {
    color: "#bbb",
    fontSize: 12,
  },

  slide: {
    width,
    height,
    justifyContent: "center",
    alignItems: "center",
  },

  image: {
    width,
    height,
  },

  video: {
    width,
    height: height * 0.75,
  },

  thumbBar: {
    position: "absolute",
    bottom: 40,
    width: "100%",
  },

  thumbWrapper: {
    marginHorizontal: 6,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },

  thumbActive: {
    borderColor: "#fff",
  },

  thumb: {
    width: 60,
    height: 60,
  },

  videoThumb: {
    width: 60,
    height: 60,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default MediaViewer;