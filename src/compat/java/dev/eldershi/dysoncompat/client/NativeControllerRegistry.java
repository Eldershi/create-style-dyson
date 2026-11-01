package dev.eldershi.dysoncompat.client;

import java.util.Collections;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.client.renderer.LevelRenderer;
import net.minecraft.world.level.block.entity.BlockEntity;
import org.mob.dysoncubeproject.block.entity.EMRailEjectorBlockEntity;
import org.mob.dysoncubeproject.block.entity.RayReceiverBlockEntity;

/** Individual BE lifecycle registration into the surviving native global pass. */
public final class NativeControllerRegistry {
    private static final WeakControllerIndex<BlockEntity> KNOWN = new WeakControllerIndex<>();
    private static final AtomicLong REGISTRATIONS = new AtomicLong();
    private static final AtomicLong REMOVALS = new AtomicLong();
    private static final AtomicLong REBINDS = new AtomicLong();
    private static final AtomicLong MESH_SKIPS = new AtomicLong();

    private NativeControllerRegistry() {}

    private static boolean controller(BlockEntity entity) {
        return entity instanceof EMRailEjectorBlockEntity || entity instanceof RayReceiverBlockEntity;
    }

    public static boolean owns(BlockEntity entity) {
        if (!controller(entity)) return false;
        return Minecraft.m_91087_().m_167982_().m_112265_(entity) instanceof ApprovedRendererBridge<?>;
    }

    public static void register(BlockEntity entity) {
        if (!controller(entity) || !(entity.m_58904_() instanceof ClientLevel) || entity.m_58901_() || !owns(entity)) return;
        if (KNOWN.add(entity)) REGISTRATIONS.incrementAndGet();
        Minecraft client = Minecraft.m_91087_();
        if (entity.m_58904_() == client.f_91073_)
            client.f_91060_.m_109762_(Collections.emptyList(), Collections.singletonList(entity));
    }

    public static void unregister(BlockEntity entity) {
        if (!controller(entity) || !KNOWN.remove(entity)) return;
        REMOVALS.incrementAndGet();
        Minecraft.m_91087_().f_91060_.m_109762_(Collections.singletonList(entity), Collections.emptyList());
    }

    /** Rebind only previously registered controllers after a native renderer reset. */
    public static void rebind(LevelRenderer renderer, ClientLevel world) {
        var controllers = KNOWN.retain(entity -> world != null && entity.m_58904_() == world && !entity.m_58901_() && owns(entity));
        if (!controllers.isEmpty()) renderer.m_109762_(Collections.emptyList(), controllers);
        REBINDS.incrementAndGet();
    }

    /** Embeddium's section-mesh lists must not duplicate our native global owner. */
    public static boolean skipSectionOwnership(BlockEntity entity) {
        if (!owns(entity)) return false;
        MESH_SKIPS.incrementAndGet();
        return true;
    }

    static void appendStats(Map<String, Object> result) {
        result.put("trackedControllers", KNOWN.size());
        result.put("lifecycleRegistrations", REGISTRATIONS.get());
        result.put("lifecycleRemovals", REMOVALS.get());
        result.put("lifecycleRebinds", REBINDS.get());
        result.put("meshOwnershipSkips", MESH_SKIPS.get());
    }
}
