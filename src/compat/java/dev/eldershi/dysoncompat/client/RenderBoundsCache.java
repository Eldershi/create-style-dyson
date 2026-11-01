package dev.eldershi.dysoncompat.client;

import net.minecraft.core.BlockPos;
import net.minecraft.world.phys.AABB;

/** Per-controller cache; no global world, block-entity or chunk references. */
public final class RenderBoundsCache {
    private final int kind;
    private final double nativeLift;
    private volatile Cached cached;

    public RenderBoundsCache(int kind, double nativeLift) {
        if (kind < 0 || kind > 1 || !Double.isFinite(nativeLift)) throw new IllegalArgumentException("Invalid render bounds kind");
        this.kind = kind;
        this.nativeLift = nativeLift;
    }

    public AABB expand(AABB original, BlockPos pos) {
        ApprovedVisuals.BOUNDS_CALLS.incrementAndGet();
        ApprovedVisuals.Gate gate = ApprovedVisuals.gate();
        if (!gate.active || original == null) return original;
        // Preserve special native/third-party boxes rather than narrowing them.
        if (!finite(original)) return original;
        int x = pos.m_123341_(), y = pos.m_123342_(), z = pos.m_123343_();
        Cached previous = cached;
        if (previous != null && previous.matches(gate.epoch, x, y, z, original)) return previous.merged;
        double[] local = ApprovedVisuals.envelope(kind);
        AABB merged = new AABB(
            Math.min(original.f_82288_, local[0] + x),
            Math.min(Math.min(original.f_82289_, original.f_82289_ + nativeLift), local[1] + y),
            Math.min(original.f_82290_, local[2] + z),
            Math.max(original.f_82291_, local[3] + x),
            Math.max(Math.max(original.f_82292_, original.f_82292_ + nativeLift), local[4] + y),
            Math.max(original.f_82293_, local[5] + z));
        cached = new Cached(gate.epoch, x, y, z, original, merged);
        ApprovedVisuals.MERGED_ALLOCATIONS.incrementAndGet();
        return merged;
    }

    private static boolean finite(AABB box) {
        return Double.isFinite(box.f_82288_) && Double.isFinite(box.f_82289_) && Double.isFinite(box.f_82290_)
            && Double.isFinite(box.f_82291_) && Double.isFinite(box.f_82292_) && Double.isFinite(box.f_82293_);
    }

    private static final class Cached {
        final long epoch;
        final int x, y, z;
        final AABB original, merged;
        Cached(long epoch, int x, int y, int z, AABB original, AABB merged) {
            this.epoch = epoch; this.x = x; this.y = y; this.z = z;
            this.original = original; this.merged = merged;
        }
        boolean matches(long epoch, int x, int y, int z, AABB box) {
            return this.epoch == epoch && this.x == x && this.y == y && this.z == z
                && original.f_82288_ == box.f_82288_ && original.f_82289_ == box.f_82289_ && original.f_82290_ == box.f_82290_
                && original.f_82291_ == box.f_82291_ && original.f_82292_ == box.f_82292_ && original.f_82293_ == box.f_82293_;
        }
    }
}
