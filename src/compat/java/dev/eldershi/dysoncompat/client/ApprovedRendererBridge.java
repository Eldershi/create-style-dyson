package dev.eldershi.dysoncompat.client;

import com.mojang.blaze3d.vertex.PoseStack;
import java.util.Map;
import java.util.Objects;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.blockentity.BlockEntityRenderer;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.phys.Vec3;

/** Native section classification around the existing typed script renderer. */
public final class ApprovedRendererBridge<T extends BlockEntity> implements BlockEntityRenderer<T> {
    private final BlockEntityRenderer<T> delegate;

    private ApprovedRendererBridge(BlockEntityRenderer<T> delegate) {
        this.delegate = Objects.requireNonNull(delegate, "renderer");
        ApprovedVisuals.WRAPPED_INSTANCES.incrementAndGet();
    }

    public static <T extends BlockEntity> BlockEntityRenderer<T> wrap(BlockEntityRenderer<T> renderer) {
        if (renderer instanceof ApprovedRendererBridge<?>) return renderer;
        return new ApprovedRendererBridge<>(renderer);
    }

    public static boolean isActive() { return ApprovedVisuals.isActive(); }
    public static boolean hasPreparedResources() { return ApprovedVisuals.hasPreparedResources(); }
    public static Map<String, Object> stats() { return ApprovedVisuals.stats(); }
    public static void onModelBakingCompleted() { ApprovedVisuals.onModelBakingCompleted(); }

    @Override
    public void m_6922_(T entity, float partialTick, PoseStack pose, MultiBufferSource buffers, int light, int overlay) {
        ApprovedVisuals.WRAPPED_DRAWS.incrementAndGet();
        delegate.m_6922_(entity, partialTick, pose, buffers, light, overlay);
    }

    // The global list still uses BE render bounds and the delegated distance.
    // Classification stays stable while resource packs are toggled/rebuilt.
    @Override
    public boolean m_5932_(T entity) { return true; }

    @Override
    public int m_142163_() { return delegate.m_142163_(); }

    @Override
    public boolean m_142756_(T entity, Vec3 camera) { return delegate.m_142756_(entity, camera); }
}
