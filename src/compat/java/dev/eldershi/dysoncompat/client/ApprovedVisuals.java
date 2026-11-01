package dev.eldershi.dysoncompat.client;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import net.minecraft.client.Minecraft;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.packs.resources.ResourceManager;
import net.minecraftforge.client.model.obj.ObjLoader;

/** Client resource gate and immutable, build-generated model envelopes. */
public final class ApprovedVisuals {
    private static final String BOUNDS = "/create_style_dyson_compat/approved-bounds.json";
    private static final double[][] ENVELOPES = loadEnvelopes();
    private static volatile Gate gate = new Gate(false, 0);
    private static volatile boolean preparedResources;
    static final AtomicLong BOUNDS_CALLS = new AtomicLong();
    static final AtomicLong MERGED_ALLOCATIONS = new AtomicLong();
    static final AtomicLong WRAPPED_DRAWS = new AtomicLong();
    static final AtomicLong WRAPPED_INSTANCES = new AtomicLong();
    static final AtomicLong OBJ_PREPARE_RELOADS = new AtomicLong();

    private ApprovedVisuals() {}

    static final class Gate {
        final boolean active;
        final long epoch;
        Gate(boolean active, long epoch) { this.active = active; this.epoch = epoch; }
    }

    static Gate gate() { return gate; }
    static double[] envelope(int kind) { return ENVELOPES[kind]; }

    static synchronized void updateAvailability(boolean active) {
        gate = new Gate(active, gate.epoch + 1);
    }

    /** Called by the paired startup script after ModelEvent.BakingCompleted. */
    public static void onModelBakingCompleted() {
        preparedResources = hasApprovedResources(Minecraft.m_91087_().m_91098_());
        updateAvailability(preparedResources);
    }

    static boolean hasApprovedResources(ResourceManager resources) {
        boolean rail = resources.m_213713_(new ResourceLocation("dcp_scripted_rail", "models/block/rail_parts.json")).isPresent();
        boolean receiver = resources.m_213713_(new ResourceLocation("dcp_scripted_receiver", "models/block/receiver_parts.json")).isPresent();
        return rail && receiver;
    }

    static boolean needsObjPreparation(ResourceManager resources) {
        return isActive() || hasApprovedResources(resources);
    }

    /** Bind OBJ lookup/caches before this reload's asynchronous model reads. */
    public static void onModelPreparation(ResourceManager resources) {
        preparedResources = hasApprovedResources(resources);
        if (!isActive() && !preparedResources) return;
        ObjLoader.INSTANCE.m_6213_(resources);
        OBJ_PREPARE_RELOADS.incrementAndGet();
    }

    public static boolean isActive() { return gate.active; }
    public static boolean hasPreparedResources() { return preparedResources; }

    public static Map<String, Object> stats() {
        Gate current = gate;
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("active", current.active);
        result.put("preparedResources", preparedResources);
        result.put("gateEpoch", current.epoch);
        result.put("boundsCalls", BOUNDS_CALLS.get());
        result.put("mergedAllocations", MERGED_ALLOCATIONS.get());
        result.put("wrappedDraws", WRAPPED_DRAWS.get());
        result.put("wrappedInstances", WRAPPED_INSTANCES.get());
        result.put("objPrepareReloads", OBJ_PREPARE_RELOADS.get());
        NativeControllerRegistry.appendStats(result);
        return result;
    }

    private static double[][] loadEnvelopes() {
        try (InputStream stream = ApprovedVisuals.class.getResourceAsStream(BOUNDS)) {
            if (stream == null) throw new IllegalStateException("Missing approved render bounds");
            JsonObject object = JsonParser.parseReader(new InputStreamReader(stream, StandardCharsets.UTF_8)).getAsJsonObject();
            double[][] bounds = new double[2][6];
            String[] names = { "rail", "receiver" };
            for (int kind = 0; kind < names.length; kind++) {
                JsonArray array = object.getAsJsonArray(names[kind]);
                if (array == null || array.size() != 6) throw new IllegalStateException("Invalid " + names[kind] + " envelope");
                for (int i = 0; i < 6; i++) {
                    bounds[kind][i] = array.get(i).getAsDouble();
                    if (!Double.isFinite(bounds[kind][i])) throw new IllegalStateException("Non-finite approved envelope");
                }
                for (int axis = 0; axis < 3; axis++) {
                    if (bounds[kind][axis] >= bounds[kind][axis + 3]) throw new IllegalStateException("Empty approved envelope");
                }
            }
            return bounds;
        } catch (java.io.IOException error) {
            throw new IllegalStateException("Cannot read approved render bounds", error);
        }
    }
}
